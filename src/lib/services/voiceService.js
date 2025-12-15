// src/lib/services/voiceService.js
// Web Speech API integration for voice input/output
// Phase 4 - Premium Feature: Voice Input/Output

import { browser } from '$app/environment';
import { writable } from 'svelte/store';

// Voice service state
export const voiceState = writable({
    isSupported: false,
    isListening: false,
    isSpeaking: false,
    transcript: '',
    error: null,
    language: 'en-US'
});

class VoiceService {
    constructor() {
        this.recognition = null;
        this.synthesis = null;
        this.isSupported = false;
        this.onTranscript = null;
        this.onEnd = null;
        this.onError = null;
        
        if (browser) {
            this.init();
        }
    }

    init() {
        // Check for Speech Recognition support
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (SpeechRecognition) {
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.interimResults = true;
            this.recognition.lang = 'en-US';
            this.recognition.maxAlternatives = 1;
            
            this.recognition.onstart = () => {
                voiceState.update(s => ({ ...s, isListening: true, error: null }));
            };
            
            this.recognition.onresult = (event) => {
                let finalTranscript = '';
                let interimTranscript = '';
                
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        finalTranscript += transcript;
                    } else {
                        interimTranscript += transcript;
                    }
                }
                
                const currentTranscript = finalTranscript || interimTranscript;
                voiceState.update(s => ({ ...s, transcript: currentTranscript }));
                
                if (finalTranscript && this.onTranscript) {
                    this.onTranscript(finalTranscript.trim());
                }
            };
            
            this.recognition.onerror = (event) => {
                console.error('[VoiceService] Recognition error:', event.error);
                let errorMessage = 'Voice recognition error';
                
                switch (event.error) {
                    case 'no-speech':
                        errorMessage = 'No speech detected. Please try again.';
                        break;
                    case 'audio-capture':
                        errorMessage = 'No microphone found. Please check your device.';
                        break;
                    case 'not-allowed':
                        errorMessage = 'Microphone access denied. Please allow microphone access.';
                        break;
                    case 'network':
                        errorMessage = 'Network error. Please check your connection.';
                        break;
                }
                
                voiceState.update(s => ({ ...s, isListening: false, error: errorMessage }));
                if (this.onError) this.onError(errorMessage);
            };
            
            this.recognition.onend = () => {
                voiceState.update(s => ({ ...s, isListening: false }));
                if (this.onEnd) this.onEnd();
            };
            
            this.isSupported = true;
        }
        
        // Check for Speech Synthesis support
        if (window.speechSynthesis) {
            this.synthesis = window.speechSynthesis;
        }
        
        voiceState.update(s => ({ ...s, isSupported: this.isSupported }));
    }

    /**
     * Start listening for voice input
     */
    startListening(callbacks = {}) {
        if (!this.recognition) {
            console.warn('[VoiceService] Speech recognition not supported');
            return false;
        }
        
        this.onTranscript = callbacks.onTranscript || null;
        this.onEnd = callbacks.onEnd || null;
        this.onError = callbacks.onError || null;
        
        try {
            voiceState.update(s => ({ ...s, transcript: '', error: null }));
            this.recognition.start();
            return true;
        } catch (error) {
            console.error('[VoiceService] Failed to start:', error);
            return false;
        }
    }

    /**
     * Stop listening
     */
    stopListening() {
        if (this.recognition) {
            try {
                this.recognition.stop();
            } catch (error) {
                console.error('[VoiceService] Failed to stop:', error);
            }
        }
    }

    /**
     * Speak text using speech synthesis
     */
    speak(text, options = {}) {
        if (!this.synthesis) {
            console.warn('[VoiceService] Speech synthesis not supported');
            return false;
        }
        
        // Cancel any ongoing speech
        this.synthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = options.lang || 'en-US';
        utterance.rate = options.rate || 1.0;
        utterance.pitch = options.pitch || 1.0;
        utterance.volume = options.volume || 1.0;
        
        // Try to use a natural voice
        const voices = this.synthesis.getVoices();
        const preferredVoice = voices.find(v => 
            v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Premium'))
        ) || voices.find(v => v.lang.startsWith('en'));
        
        if (preferredVoice) {
            utterance.voice = preferredVoice;
        }
        
        utterance.onstart = () => {
            voiceState.update(s => ({ ...s, isSpeaking: true }));
        };
        
        utterance.onend = () => {
            voiceState.update(s => ({ ...s, isSpeaking: false }));
            if (options.onEnd) options.onEnd();
        };
        
        utterance.onerror = (event) => {
            console.error('[VoiceService] Synthesis error:', event);
            voiceState.update(s => ({ ...s, isSpeaking: false }));
        };
        
        this.synthesis.speak(utterance);
        return true;
    }

    /**
     * Stop speaking
     */
    stopSpeaking() {
        if (this.synthesis) {
            this.synthesis.cancel();
            voiceState.update(s => ({ ...s, isSpeaking: false }));
        }
    }

    /**
     * Check if voice is supported
     */
    checkSupport() {
        return {
            recognition: !!this.recognition,
            synthesis: !!this.synthesis,
            isSupported: this.isSupported
        };
    }

    /**
     * Set language
     */
    setLanguage(lang) {
        if (this.recognition) {
            this.recognition.lang = lang;
        }
        voiceState.update(s => ({ ...s, language: lang }));
    }
}

// Singleton instance
let voiceServiceInstance = null;

export function getVoiceService() {
    if (!voiceServiceInstance && browser) {
        voiceServiceInstance = new VoiceService();
    }
    return voiceServiceInstance;
}

export default VoiceService;
