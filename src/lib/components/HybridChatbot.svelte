<script>
    import { onMount, onDestroy, tick } from 'svelte';
    import { browser } from '$app/environment';
    import { fly, fade, scale } from 'svelte/transition';
    import { cubicOut, backOut } from 'svelte/easing';
    import { chatbotStore, MESSAGE_TYPES, CHATBOT_ROLES } from '$lib/stores/chatbot';
    import { getHybridEngine, AI_STATES } from '$lib/ai/hybridEngine';
    import { getVoiceService, voiceState } from '$lib/services/voiceService';
    import AI3DAssistant from './AI3DAssistant.svelte';
    import { IconX, IconSend, IconMinus, IconTrash, IconSparkles, IconChevronDown, IconMaximize, IconMicrophone, IconMicrophoneOff, IconRefresh } from '@tabler/icons-svelte';
    
    // Check if mobile for different animations
    $: isMobile = browser && window.innerWidth <= 640;

    export let role = CHATBOT_ROLES.USER;
    export let userId = null;
    export let userProfile = null;

    let inputValue = '';
    let messagesContainer;
    let inputElement;
    let isAtBottom = true;
    let showScrollButton = false;
    let aiState = AI_STATES.IDLE;
    let hybridEngine = null;
    let voiceService = null;
    let isVoiceSupported = false;

    $: isOpen = $chatbotStore.isOpen;
    $: isMinimized = $chatbotStore.isMinimized;
    $: messages = $chatbotStore.messages;
    $: isTyping = $chatbotStore.isTyping;
    $: unreadCount = $chatbotStore.unreadCount;
    $: suggestedQueries = $chatbotStore.suggestedQueries;
    $: storeOnboarding = $chatbotStore.isOnboarding;
    $: isRecording = $voiceState.isListening;
    $: voiceTranscript = $voiceState.transcript;
    
    // Only block input if there's an actual onboarding message with actions pending
    $: hasOnboardingMessage = messages.some(m => m.type === MESSAGE_TYPES.ONBOARDING && m.content?.actions?.length > 0);
    $: isOnboarding = storeOnboarding && hasOnboardingMessage;

    // Update input with voice transcript
    $: if (voiceTranscript && isRecording) {
        inputValue = voiceTranscript;
    }

    onMount(() => {
        if (browser) {
            hybridEngine = getHybridEngine({ onStateChange: (state) => { aiState = state; } });
            chatbotStore.init(role, { userId, userProfile });
            
            // Initialize voice service
            voiceService = getVoiceService();
            if (voiceService) {
                const support = voiceService.checkSupport();
                isVoiceSupported = support.recognition;
            }
        }
    });

    onDestroy(() => { 
        if (browser) {
            chatbotStore.reset();
            if (voiceService && $voiceState.isListening) {
                voiceService.stopListening();
            }
        }
    });

    async function scrollToBottom(smooth = true) {
        await tick();
        if (messagesContainer) {
            messagesContainer.scrollTo({ top: messagesContainer.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
            isAtBottom = true;
            showScrollButton = false;
        }
    }

    function handleScroll() {
        if (messagesContainer) {
            const { scrollTop, scrollHeight, clientHeight } = messagesContainer;
            isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
            showScrollButton = !isAtBottom && messages.length > 3;
        }
    }

    $: if (messages.length && isAtBottom) scrollToBottom();

    async function handleSend() {
        const message = inputValue.trim();
        if (!message || isTyping) return;
        
        // Stop voice if recording
        if (isRecording && voiceService) {
            voiceService.stopListening();
        }
        
        chatbotStore.checkSession();
        inputValue = '';
        chatbotStore.addUserMessage(message);
        aiState = AI_STATES.LISTENING;
        
        try {
            const result = await hybridEngine.processMessage(message, { 
                role, 
                userId, 
                userProfile, 
                systemData: { 
                    currentTime: new Date().toISOString(), 
                    userRole: role, 
                    userId 
                } 
            });
            await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 400));
            const botMessage = formatAIResponse(result);
            chatbotStore.addBotMessage(botMessage);
            if (result.suggestions?.length) chatbotStore.updateSuggestions(result.suggestions);
            aiState = AI_STATES.IDLE;
        } catch (error) {
            console.error('[HybridChatbot] Error:', error);
            chatbotStore.addBotMessage({ type: MESSAGE_TYPES.ERROR, content: "I encountered an issue. Please try again." });
            aiState = AI_STATES.ERROR;
            setTimeout(() => aiState = AI_STATES.IDLE, 2000);
        }
    }

    function formatAIResponse(result) {
        // Handle both 'content' and 'response' field names
        const responseText = result.content || result.response || '';
        if (result.actions?.length) return { type: MESSAGE_TYPES.CARD, content: { icon: '🤖', title: 'Assistant', description: responseText, status: result.success !== false ? 'success' : 'warning', actions: result.actions } };
        if (result.requiresConfirmation) return { type: MESSAGE_TYPES.CONFIRMATION, content: { message: responseText, confirmAction: result.confirmAction, cancelAction: result.cancelAction } };
        return { type: MESSAGE_TYPES.TEXT, content: responseText || "I'm here to help! What would you like to know?" };
    }

    function handleKeydown(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }
    function handleQuickReply(query) { inputValue = query; handleSend(); }
    function handleAction(action) {
        if (action.href && action.href !== '#') { window.location.href = action.href; chatbotStore.close(); }
        else if (action.query) { inputValue = action.query; handleSend(); }
        else if (action.action) { chatbotStore.progressOnboarding(action.action); }
    }
    function handleSuggestionClick(query) { inputValue = query; handleSend(); }
    function formatTime(timestamp) { return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
    
    function toggleVoice() {
        if (!voiceService || !isVoiceSupported) return;
        
        if (isRecording) {
            voiceService.stopListening();
            // Auto-send if we have transcript
            if (inputValue.trim()) {
                setTimeout(() => handleSend(), 300);
            }
        } else {
            aiState = AI_STATES.LISTENING;
            voiceService.startListening({
                onTranscript: (transcript) => {
                    inputValue = transcript;
                },
                onEnd: () => {
                    aiState = AI_STATES.IDLE;
                    // Auto-send after voice ends if we have content
                    if (inputValue.trim()) {
                        setTimeout(() => handleSend(), 500);
                    }
                },
                onError: (error) => {
                    console.error('[Voice] Error:', error);
                    aiState = AI_STATES.ERROR;
                    setTimeout(() => aiState = AI_STATES.IDLE, 2000);
                }
            });
        }
    }
    
    function refreshChat() { chatbotStore.clearMessages(); hybridEngine?.resetContext(); aiState = AI_STATES.IDLE; }
</script>

{#if !isOpen}
<button 
    class="chat-fab" 
    class:has-unread={unreadCount > 0} 
    on:click={() => chatbotStore.open()} 
    aria-label="Open AI assistant"
    in:scale={{ duration: 300, delay: 200, start: 0.5, easing: backOut }}
    out:scale={{ duration: 200, start: 0.8, easing: cubicOut }}
>
    <div class="fab-orb"><AI3DAssistant state={aiState} size={44} position="inline" showLabel={false} /></div>
    {#if unreadCount > 0}<span class="unread-badge" in:scale={{ duration: 200, start: 0.5 }}>{unreadCount > 9 ? '9+' : unreadCount}</span>{/if}
    <span class="fab-tooltip">{role === CHATBOT_ROLES.ADMIN ? 'AI Admin Assistant' : 'AI Assistant'}</span>
</button>
{/if}

{#if isOpen}
<div 
    class="chat-window" 
    class:minimized={isMinimized}
    in:fly={{ y: isMobile ? 100 : 30, duration: 350, easing: cubicOut }}
    out:fly={{ y: isMobile ? 100 : 30, duration: 250, easing: cubicOut }}
>
    <div class="chat-header" class:admin={role === CHATBOT_ROLES.ADMIN}>
        <div class="header-info">
            <div class="header-orb"><AI3DAssistant state={aiState} size={36} position="inline" showLabel={false} /></div>
            <div class="header-text">
                <span class="bot-name">{role === CHATBOT_ROLES.ADMIN ? 'AI Admin Assistant' : 'AI Assistant'}</span>
                <span class="bot-status"><span class="status-dot" class:thinking={aiState === AI_STATES.THINKING}></span>
                    {#if aiState === AI_STATES.THINKING}Thinking...{:else if aiState === AI_STATES.LISTENING}Listening...{:else}Online{/if}
                </span>
            </div>
        </div>
        <div class="header-actions">
            <button class="header-btn" on:click={refreshChat} title="Refresh"><IconRefresh size={16} stroke={1.5} /></button>
            <button class="header-btn" on:click={() => chatbotStore.clearMessages()} title="Clear"><IconTrash size={16} stroke={1.5} /></button>
            {#if isMinimized}<button class="header-btn" on:click={() => chatbotStore.restore()} title="Restore"><IconMaximize size={16} stroke={1.5} /></button>
            {:else}<button class="header-btn" on:click={() => chatbotStore.minimize()} title="Minimize"><IconMinus size={16} stroke={1.5} /></button>{/if}
            <button class="header-btn close" on:click={() => chatbotStore.close()} title="Close"><IconX size={16} stroke={1.5} /></button>
        </div>
    </div>
    {#if !isMinimized}
    <div class="chat-messages" bind:this={messagesContainer} on:scroll={handleScroll}>
        {#each messages as message (message.id)}
        <div class="message" class:user={message.sender === 'user'} class:bot={message.sender === 'bot'}>
            {#if message.sender === 'bot'}<div class="message-avatar"><AI3DAssistant state={AI_STATES.IDLE} size={28} position="inline" showLabel={false} /></div>{/if}
            <div class="message-content">
                {#if message.type === MESSAGE_TYPES.TEXT || message.type === MESSAGE_TYPES.SYSTEM}
                <div class="message-bubble" class:system={message.type === MESSAGE_TYPES.SYSTEM}><p>{@html (message.content || '').toString().replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>')}</p></div>
                {:else if message.type === MESSAGE_TYPES.CARD}
                <div class="message-card" class:success={message.content?.status === 'success'} class:warning={message.content?.status === 'warning'} class:error={message.content?.status === 'error'}>
                    <div class="card-header"><span class="card-icon">{message.content?.icon || '💬'}</span><span class="card-title">{message.content?.title || ''}</span></div>
                    <p class="card-description">{@html (message.content?.description || '').toString().replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>')}</p>
                    {#if message.content.details}<p class="card-details">{message.content.details}</p>{/if}
                    {#if message.content.actions}<div class="card-actions">{#each message.content.actions as action}<button type="button" class="card-action-btn" on:click|stopPropagation={() => handleAction(action)} on:touchend|preventDefault|stopPropagation={() => handleAction(action)}>{action.label}</button>{/each}</div>{/if}
                </div>
                {:else if message.type === MESSAGE_TYPES.STATS}
                <div class="message-stats">
                    <p class="stats-title">{message.content?.title || ''}</p>
                    {#if message.content?.subtitle}<p class="stats-subtitle">{message.content.subtitle}</p>{/if}
                    <div class="stats-grid">{#each message.content?.stats || [] as stat}<div class="stat-item" class:green={stat.color === 'green'} class:yellow={stat.color === 'yellow'} class:red={stat.color === 'red'}><span class="stat-icon">{stat.icon}</span><span class="stat-value">{stat.value}</span><span class="stat-label">{stat.label}</span></div>{/each}</div>
                    {#if message.content?.note}<p class="stats-note">{message.content.note}</p>{/if}
                </div>
                {:else if message.type === MESSAGE_TYPES.GUIDE}
                <div class="message-guide">
                    <p class="guide-title">{message.content?.title || ''}</p>
                    {#each message.content?.sections || [] as section}<div class="guide-section"><p class="section-heading">{section.heading}</p><p class="section-text">{@html (section.text || '').toString().replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>')}</p></div>{/each}
                    {#if message.content?.actions}<div class="guide-actions">{#each message.content.actions as action}<button class="guide-action-btn" on:click={() => handleAction(action)}>{action.label}</button>{/each}</div>{/if}
                </div>
                {:else if message.type === MESSAGE_TYPES.LIST}
                <div class="message-list" class:warning={message.content?.status === 'warning'} class:error={message.content?.status === 'error'}>
                    <div class="list-header"><span class="list-icon">{message.content?.icon || '📋'}</span><div class="list-titles"><span class="list-title">{message.content?.title || ''}</span>{#if message.content?.subtitle}<span class="list-subtitle">{message.content.subtitle}</span>{/if}</div></div>
                    <div class="list-items">{#each message.content?.items || [] as item}<div class="list-item"><span class="item-primary">{item.primary}</span>{#if item.secondary}<span class="item-secondary">{item.secondary}</span>{/if}</div>{/each}</div>
                    {#if message.content.note}<p class="list-note">{message.content.note}</p>{/if}
                    {#if message.content.actions}<div class="list-actions">{#each message.content.actions as action}<button class="list-action-btn" on:click={() => handleAction(action)}>{action.label}</button>{/each}</div>{/if}
                </div>
                {:else if message.type === MESSAGE_TYPES.QUICK_REPLIES}
                <div class="message-quick-replies"><p class="quick-title">{message.content?.title || ''}</p><div class="quick-options">{#each message.content?.options || [] as option}<button class="quick-btn" on:click={() => handleQuickReply(option.query)}>{option.label}</button>{/each}</div></div>
                {:else if message.type === MESSAGE_TYPES.ONBOARDING}
                <div class="message-onboarding">
                    <div class="onboarding-header"><span class="onboarding-step">Getting Started</span>{#if message.content?.progress}<span class="onboarding-progress">{message.content.progress}/{message.content.totalSteps}</span>{/if}</div>
                    <p class="onboarding-title">{message.content?.title || ''}</p><p class="onboarding-description">{message.content?.description || ''}</p>
                    {#if message.content?.actions}<div class="onboarding-actions">{#each message.content.actions as action}<button type="button" class="onboarding-btn" class:primary={action.action === 'next'} class:secondary={action.action === 'skip'} on:click|stopPropagation={() => handleAction(action)} on:touchend|preventDefault|stopPropagation={() => handleAction(action)}>{action.label}</button>{/each}</div>{/if}
                </div>
                {:else if message.type === MESSAGE_TYPES.ERROR}
                <div class="message-bubble error"><p>{message.content || 'An error occurred'}</p></div>
                {/if}
                <span class="message-time">{formatTime(message.timestamp)}</span>
            </div>
        </div>
        {/each}
        {#if isTyping}<div class="message bot"><div class="message-avatar"><AI3DAssistant state={AI_STATES.THINKING} size={28} position="inline" showLabel={false} /></div><div class="typing-indicator"><span></span><span></span><span></span></div></div>{/if}
    </div>
    {#if showScrollButton}<button class="scroll-bottom-btn" on:click={() => scrollToBottom()}><IconChevronDown size={20} stroke={2} /></button>{/if}
    {#if suggestedQueries.length > 0 && messages.length <= 2 && !isOnboarding}<div class="suggestions-bar">{#each suggestedQueries as suggestion}<button class="suggestion-chip" on:click={() => handleSuggestionClick(suggestion.query)}>{suggestion.label}</button>{/each}</div>{/if}
    <div class="chat-input">
        {#if isVoiceSupported}
        <button 
            type="button"
            class="voice-btn" 
            class:active={isRecording} 
            on:click|stopPropagation={toggleVoice} 
            on:touchend|preventDefault|stopPropagation={toggleVoice}
            title={isRecording ? 'Stop recording' : 'Voice input'} 
            disabled={isTyping || isOnboarding}
        >
            {#if isRecording}<IconMicrophoneOff size={18} stroke={1.5} />{:else}<IconMicrophone size={18} stroke={1.5} />{/if}
        </button>
        {/if}
        <input 
            type="text" 
            bind:value={inputValue} 
            bind:this={inputElement} 
            on:keydown={handleKeydown} 
            placeholder={isRecording ? "Listening..." : isOnboarding ? "Complete the tour first..." : "Ask me anything..."} 
            disabled={isTyping || isOnboarding}
            autocomplete="off"
            autocorrect="on"
            autocapitalize="sentences"
        />
        <button 
            type="button"
            class="send-btn" 
            on:click|stopPropagation={handleSend}
            on:touchend|preventDefault|stopPropagation={handleSend}
            disabled={!inputValue.trim() || isTyping || isOnboarding} 
            aria-label="Send"
        >
            <IconSend size={18} stroke={1.5} />
        </button>
    </div>
    <div class="ai-badge"><IconSparkles size={12} stroke={1.5} /><span>Powered by Gemini Flash</span></div>
    {/if}
</div>
{/if}


<style>
    /* FAB Button */
    .chat-fab { position: fixed; bottom: 24px; right: 24px; width: 64px; height: 64px; border-radius: 50%; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 9999; transition: all 0.3s cubic-bezier(0.25, 0.1, 0.25, 1); background: rgba(255, 255, 255, 0.9); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); box-shadow: 0 8px 32px rgba(0, 122, 255, 0.25); touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
    .chat-fab:hover { transform: scale(1.08) translateY(-2px); box-shadow: 0 12px 40px rgba(0, 122, 255, 0.35); }
    .chat-fab:active { transform: scale(0.95); }
    .chat-fab.has-unread { animation: fabPulse 2s infinite; }
    @keyframes fabPulse { 0%, 100% { box-shadow: 0 8px 32px rgba(0, 122, 255, 0.25); } 50% { box-shadow: 0 8px 40px rgba(0, 122, 255, 0.45); } }
    .fab-orb { display: flex; align-items: center; justify-content: center; }
    .unread-badge { position: absolute; top: -4px; right: -4px; min-width: 20px; height: 20px; background: var(--apple-red, #FF3B30); color: white; font-size: 11px; font-weight: 600; border-radius: 10px; display: flex; align-items: center; justify-content: center; padding: 0 6px; }
    .fab-tooltip { position: absolute; right: 74px; background: var(--theme-card-bg, white); color: var(--theme-text, #1d1d1f); padding: 8px 14px; border-radius: 10px; font-size: 13px; font-weight: 500; white-space: nowrap; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12); opacity: 0; pointer-events: none; transition: opacity 0.2s; }
    .chat-fab:hover .fab-tooltip { opacity: 1; }

    /* Chat Window */
    .chat-window { position: fixed; bottom: 24px; right: 24px; width: 400px; max-width: calc(100vw - 48px); height: 600px; max-height: calc(100vh - 100px); background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(20px) saturate(180%); -webkit-backdrop-filter: blur(20px) saturate(180%); border-radius: 24px; box-shadow: 0 24px 80px rgba(0, 0, 0, 0.15), 0 8px 32px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.8); display: flex; flex-direction: column; overflow: hidden; z-index: 10003; border: 1px solid rgba(255, 255, 255, 0.5); }
    .chat-window.minimized { height: auto; }

    /* Header */
    .chat-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; background: linear-gradient(135deg, #007AFF 0%, #5856D6 100%); color: white; border-radius: 24px 24px 0 0; }
    .chat-header.admin { background: linear-gradient(135deg, #5856D6 0%, #AF52DE 100%); }
    .header-info { display: flex; align-items: center; gap: 12px; }
    .header-orb { display: flex; align-items: center; justify-content: center; }
    .header-text { display: flex; flex-direction: column; }
    .bot-name { font-size: 15px; font-weight: 600; }
    .bot-status { font-size: 12px; opacity: 0.9; display: flex; align-items: center; gap: 6px; }
    .status-dot { width: 8px; height: 8px; background: #34C759; border-radius: 50%; transition: all 0.3s; }
    .status-dot.thinking { background: #AF52DE; animation: statusPulse 1s infinite; }
    @keyframes statusPulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.2); opacity: 0.7; } }
    .header-actions { display: flex; gap: 4px; }
    .header-btn { width: 32px; height: 32px; border: none; background: rgba(255, 255, 255, 0.15); color: white; border-radius: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
    .header-btn:hover { background: rgba(255, 255, 255, 0.25); transform: scale(1.05); }
    .header-btn.close:hover { background: rgba(255, 59, 48, 0.8); }

    /* Messages */
    .chat-messages { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 16px; background: linear-gradient(180deg, rgba(245, 245, 247, 0.5) 0%, rgba(255, 255, 255, 0.8) 100%); }
    .message { display: flex; gap: 10px; max-width: 90%; animation: messageSlideIn 0.3s ease; }
    @keyframes messageSlideIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    .message.user { align-self: flex-end; flex-direction: row-reverse; }
    .message.bot { align-self: flex-start; }
    .message-avatar { flex-shrink: 0; width: 28px; height: 28px; }
    .message-content { display: flex; flex-direction: column; }
    .message.user .message-content { align-items: flex-end; }
    .message-time { font-size: 10px; color: var(--theme-text-secondary, #86868b); margin-top: 4px; padding: 0 4px; }
    .message-bubble { padding: 12px 16px; border-radius: 20px; font-size: 14px; line-height: 1.5; max-width: 280px; }
    .message-bubble p { margin: 0; }
    .message.user .message-bubble { background: linear-gradient(135deg, #007AFF 0%, #5856D6 100%); color: white; border-bottom-right-radius: 6px; }
    .message.bot .message-bubble { background: white; color: var(--theme-text, #1d1d1f); border-bottom-left-radius: 6px; box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06); }
    .message-bubble.system { background: var(--theme-border-light, #e5e5ea); font-style: italic; }
    .message-bubble.error { background: rgba(255, 59, 48, 0.1); color: var(--apple-red, #FF3B30); }

    /* Card Messages */
    .message-card { background: white; border-radius: 18px; padding: 16px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08); border-left: 4px solid var(--apple-accent, #007AFF); max-width: 300px; }
    .message-card.success { border-left-color: var(--apple-green, #34C759); }
    .message-card.warning { border-left-color: var(--apple-orange, #FF9500); }
    .message-card.error { border-left-color: var(--apple-red, #FF3B30); }
    .card-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .card-icon { font-size: 20px; }
    .card-title { font-size: 15px; font-weight: 600; color: var(--theme-text, #1d1d1f); }
    .card-description { font-size: 14px; color: var(--theme-text, #1d1d1f); line-height: 1.5; margin: 0; }
    .card-details { font-size: 12px; color: var(--theme-text-secondary, #86868b); margin-top: 8px; }
    .card-actions { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
    .card-action-btn { padding: 10px 16px; background: var(--apple-accent, #007AFF); color: white; border: none; border-radius: 10px; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.2s; touch-action: manipulation; -webkit-tap-highlight-color: transparent; min-height: 44px; }
    .card-action-btn:hover, .card-action-btn:active { background: #0056b3; transform: translateY(-1px); }

    /* Stats Messages */
    .message-stats { background: white; border-radius: 18px; padding: 16px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08); max-width: 300px; }
    .stats-title { font-size: 15px; font-weight: 600; color: var(--theme-text, #1d1d1f); margin: 0 0 4px 0; }
    .stats-subtitle { font-size: 12px; color: var(--theme-text-secondary, #86868b); margin: 0 0 12px 0; }
    .stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
    .stat-item { background: var(--theme-bg, #f5f5f7); padding: 12px 10px; border-radius: 12px; text-align: center; }
    .stat-item.green { background: rgba(52, 199, 89, 0.1); }
    .stat-item.yellow { background: rgba(255, 149, 0, 0.1); }
    .stat-item.red { background: rgba(255, 59, 48, 0.1); }
    .stat-icon { font-size: 18px; display: block; margin-bottom: 4px; }
    .stat-value { font-size: 20px; font-weight: 700; color: var(--theme-text, #1d1d1f); display: block; }
    .stat-label { font-size: 10px; color: var(--theme-text-secondary, #86868b); display: block; margin-top: 2px; }
    .stats-note { font-size: 12px; color: var(--theme-text-secondary, #86868b); margin: 12px 0 0 0; padding-top: 12px; border-top: 1px solid var(--theme-border-light, #e5e5ea); }

    /* Guide Messages */
    .message-guide { background: white; border-radius: 18px; padding: 16px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08); max-width: 300px; }
    .guide-title { font-size: 15px; font-weight: 600; color: var(--theme-text, #1d1d1f); margin: 0 0 12px 0; }
    .guide-section { margin-bottom: 12px; }
    .guide-section:last-of-type { margin-bottom: 0; }
    .section-heading { font-size: 13px; font-weight: 600; color: var(--apple-accent, #007AFF); margin: 0 0 4px 0; }
    .section-text { font-size: 13px; color: var(--theme-text, #1d1d1f); line-height: 1.5; margin: 0; }
    .guide-actions { display: flex; gap: 8px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--theme-border-light, #e5e5ea); flex-wrap: wrap; }
    .guide-action-btn { padding: 8px 14px; background: var(--theme-bg, #f5f5f7); color: var(--apple-accent, #007AFF); border: 1px solid var(--theme-border, #d1d1d6); border-radius: 10px; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.2s; }
    .guide-action-btn:hover { background: var(--apple-accent, #007AFF); color: white; border-color: var(--apple-accent, #007AFF); }

    /* List Messages */
    .message-list { background: white; border-radius: 18px; padding: 16px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08); border-left: 4px solid var(--apple-accent, #007AFF); max-width: 300px; }
    .message-list.warning { border-left-color: var(--apple-orange, #FF9500); }
    .message-list.error { border-left-color: var(--apple-red, #FF3B30); }
    .list-header { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 12px; }
    .list-icon { font-size: 20px; }
    .list-titles { display: flex; flex-direction: column; }
    .list-title { font-size: 15px; font-weight: 600; color: var(--theme-text, #1d1d1f); }
    .list-subtitle { font-size: 12px; color: var(--theme-text-secondary, #86868b); }
    .list-items { display: flex; flex-direction: column; gap: 8px; }
    .list-item { padding: 10px 12px; background: var(--theme-bg, #f5f5f7); border-radius: 10px; }
    .item-primary { font-size: 14px; font-weight: 500; color: var(--theme-text, #1d1d1f); display: block; }
    .item-secondary { font-size: 12px; color: var(--theme-text-secondary, #86868b); display: block; margin-top: 2px; }
    .list-note { font-size: 12px; color: var(--theme-text-secondary, #86868b); margin: 8px 0 0 0; font-style: italic; }
    .list-actions { display: flex; gap: 8px; margin-top: 12px; }
    .list-action-btn { padding: 8px 14px; background: var(--apple-accent, #007AFF); color: white; border: none; border-radius: 10px; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.2s; }
    .list-action-btn:hover { background: #0056b3; }

    /* Quick Replies */
    .message-quick-replies { background: white; border-radius: 18px; padding: 16px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08); max-width: 300px; }
    .quick-title { font-size: 14px; color: var(--theme-text, #1d1d1f); margin: 0 0 12px 0; }
    .quick-options { display: flex; flex-wrap: wrap; gap: 8px; }
    .quick-btn { padding: 8px 12px; background: var(--theme-bg, #f5f5f7); color: var(--theme-text, #1d1d1f); border: 1px solid var(--theme-border, #d1d1d6); border-radius: 18px; font-size: 12px; cursor: pointer; transition: all 0.2s; }
    .quick-btn:hover { background: var(--apple-accent, #007AFF); color: white; border-color: var(--apple-accent, #007AFF); }

    /* Onboarding */
    .message-onboarding { background: linear-gradient(135deg, #007AFF 0%, #5856D6 100%); border-radius: 18px; padding: 20px; color: white; max-width: 300px; }
    .onboarding-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .onboarding-step { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.9; }
    .onboarding-progress { font-size: 12px; background: rgba(255, 255, 255, 0.2); padding: 4px 10px; border-radius: 12px; }
    .onboarding-title { font-size: 18px; font-weight: 600; margin: 0 0 8px 0; }
    .onboarding-description { font-size: 14px; line-height: 1.5; opacity: 0.95; margin: 0; }
    .onboarding-actions { display: flex; gap: 10px; margin-top: 16px; }
    .onboarding-btn { padding: 12px 24px; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; border: none; touch-action: manipulation; -webkit-tap-highlight-color: transparent; position: relative; z-index: 10; }
    .onboarding-btn.primary { background: white; color: var(--apple-accent, #007AFF); }
    .onboarding-btn.primary:hover, .onboarding-btn.primary:active { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); }
    .onboarding-btn.secondary { background: rgba(255, 255, 255, 0.2); color: white; }
    .onboarding-btn.secondary:hover, .onboarding-btn.secondary:active { background: rgba(255, 255, 255, 0.3); }

    /* Typing Indicator */
    .typing-indicator { display: flex; gap: 4px; padding: 14px 18px; background: white; border-radius: 20px; border-bottom-left-radius: 6px; box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06); }
    .typing-indicator span { width: 8px; height: 8px; background: var(--apple-accent, #007AFF); border-radius: 50%; animation: typingBounce 1.4s infinite ease-in-out; }
    .typing-indicator span:nth-child(1) { animation-delay: 0s; }
    .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
    .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes typingBounce { 0%, 60%, 100% { transform: translateY(0); opacity: 0.4; } 30% { transform: translateY(-6px); opacity: 1; } }

    /* Scroll & Suggestions */
    .scroll-bottom-btn { position: absolute; bottom: 140px; left: 50%; transform: translateX(-50%); width: 40px; height: 40px; background: white; border: 1px solid var(--theme-border, #d1d1d6); border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1); color: var(--theme-text-secondary, #86868b); transition: all 0.2s; z-index: 10; }
    .scroll-bottom-btn:hover { background: var(--apple-accent, #007AFF); color: white; border-color: var(--apple-accent, #007AFF); transform: translateX(-50%) scale(1.05); }
    .suggestions-bar { display: flex; gap: 8px; padding: 12px 20px; overflow-x: auto; background: rgba(255, 255, 255, 0.9); border-top: 1px solid rgba(0, 0, 0, 0.05); }
    .suggestions-bar::-webkit-scrollbar { display: none; }
    .suggestion-chip { padding: 8px 14px; background: var(--theme-bg, #f5f5f7); color: var(--apple-accent, #007AFF); border: 1px solid var(--theme-border, #d1d1d6); border-radius: 18px; font-size: 12px; font-weight: 500; white-space: nowrap; cursor: pointer; transition: all 0.2s; }
    .suggestion-chip:hover { background: var(--apple-accent, #007AFF); color: white; border-color: var(--apple-accent, #007AFF); transform: translateY(-1px); }

    /* Input Area */
    .chat-input { display: flex; gap: 10px; padding: 16px 20px; background: rgba(255, 255, 255, 0.95); border-top: 1px solid rgba(0, 0, 0, 0.05); align-items: center; position: relative; z-index: 100; }
    .voice-btn { width: 44px; height: 44px; background: var(--theme-bg, #f5f5f7); border: 1px solid var(--theme-border, #d1d1d6); border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--theme-text-secondary, #86868b); transition: all 0.3s cubic-bezier(0.25, 0.1, 0.25, 1); flex-shrink: 0; position: relative; z-index: 10; pointer-events: auto; }
    .voice-btn:hover:not(:disabled) { background: var(--apple-accent, #007AFF); color: white; border-color: var(--apple-accent, #007AFF); transform: scale(1.05); }
    .voice-btn.active { background: var(--apple-red, #FF3B30); color: white; border-color: var(--apple-red, #FF3B30); animation: voicePulse 1.5s infinite; box-shadow: 0 0 0 4px rgba(255, 59, 48, 0.2); }
    .voice-btn:disabled { opacity: 0.5; cursor: not-allowed; pointer-events: none; }
    @keyframes voicePulse { 0%, 100% { box-shadow: 0 0 0 4px rgba(255, 59, 48, 0.2); } 50% { box-shadow: 0 0 0 8px rgba(255, 59, 48, 0.1); } }
    .chat-input input { flex: 1; padding: 12px 18px; background: var(--theme-bg, #f5f5f7); border: 1px solid var(--theme-border, #d1d1d6); border-radius: 24px; font-size: 14px; color: var(--theme-text, #1d1d1f); outline: none; transition: all 0.2s; position: relative; z-index: 10; pointer-events: auto; min-width: 0; }
    .chat-input input:focus { border-color: var(--apple-accent, #007AFF); box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.15); }
    .chat-input input:disabled { opacity: 0.6; cursor: not-allowed; pointer-events: none; }
    .chat-input input::placeholder { color: var(--theme-text-secondary, #86868b); }
    .send-btn { width: 44px; height: 44px; background: linear-gradient(135deg, #007AFF 0%, #5856D6 100%); color: white; border: none; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; flex-shrink: 0; position: relative; z-index: 10; pointer-events: auto; }
    .send-btn:hover:not(:disabled) { transform: scale(1.05); box-shadow: 0 4px 16px rgba(0, 122, 255, 0.4); }
    .send-btn:disabled { opacity: 0.5; cursor: not-allowed; pointer-events: none; }

    /* AI Badge */
    .ai-badge { display: flex; align-items: center; justify-content: center; gap: 4px; padding: 8px; background: rgba(245, 245, 247, 0.9); font-size: 10px; color: var(--theme-text-secondary, #86868b); border-radius: 0 0 24px 24px; pointer-events: none; flex-shrink: 0; }

    /* Mobile - Messenger Style */
    @media (max-width: 640px) {
        .chat-fab { 
            bottom: 90px; 
            right: 16px; 
            width: 56px; 
            height: 56px; 
            z-index: 9999;
        }
        .chat-window { 
            position: fixed;
            top: 0;
            bottom: 0;
            right: 0;
            left: 0;
            width: 100%;
            max-width: 100%;
            height: 100%;
            max-height: 100%;
            border-radius: 0;
            z-index: 10003;
        }
        .chat-header {
            border-radius: 0;
            padding: 12px 16px;
            padding-top: calc(12px + env(safe-area-inset-top, 0px));
        }
        .chat-messages {
            flex: 1;
            padding: 16px;
            padding-bottom: 8px;
        }
        .message {
            max-width: 85%;
        }
        .message-bubble {
            max-width: 100%;
        }
        .fab-tooltip { display: none; }
        .message-card, .message-stats, .message-guide, .message-list, .message-quick-replies, .message-onboarding { 
            max-width: 100%; 
        }
        .suggestions-bar {
            padding: 10px 16px;
        }
        .chat-input { 
            padding: 12px 16px;
            padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
            gap: 10px;
            position: relative;
            z-index: 100;
            background: #ffffff;
            pointer-events: auto;
        }
        .chat-input input {
            padding: 14px 16px;
            font-size: 16px !important; /* Prevents iOS zoom on focus */
            -webkit-appearance: none;
            appearance: none;
            pointer-events: auto !important;
            touch-action: auto;
            -webkit-user-select: text;
            user-select: text;
            min-height: 48px;
            box-sizing: border-box;
        }
        .voice-btn, .send-btn {
            width: 48px !important;
            height: 48px !important;
            min-width: 48px !important;
            min-height: 48px !important;
            touch-action: manipulation;
            -webkit-tap-highlight-color: transparent;
            pointer-events: auto !important;
            cursor: pointer;
        }
        .send-btn:active:not(:disabled) {
            transform: scale(0.9);
            opacity: 0.8;
        }
        .voice-btn:active:not(:disabled) {
            transform: scale(0.9);
            opacity: 0.8;
        }
        .ai-badge {
            border-radius: 0;
            padding: 6px;
            padding-bottom: calc(6px + env(safe-area-inset-bottom, 0px));
            font-size: 9px;
            pointer-events: none;
        }
        .header-btn {
            width: 36px;
            height: 36px;
            min-width: 36px;
            min-height: 36px;
            touch-action: manipulation;
            -webkit-tap-highlight-color: transparent;
        }
        .scroll-bottom-btn {
            bottom: 160px;
        }
        /* Ensure all buttons in messages are touchable on mobile */
        .onboarding-btn {
            padding: 14px 28px !important;
            min-height: 48px;
            font-size: 15px !important;
        }
        .card-action-btn, .guide-action-btn, .list-action-btn, .quick-btn {
            min-height: 44px;
            padding: 12px 18px !important;
        }
        .suggestion-chip {
            min-height: 40px;
            padding: 10px 16px !important;
        }
        .message-onboarding {
            max-width: 100%;
        }
        .chat-messages {
            -webkit-overflow-scrolling: touch;
            overscroll-behavior: contain;
        }
    }

    /* Small Mobile */
    @media (max-width: 380px) {
        .chat-input {
            padding: 10px 12px;
            padding-bottom: calc(10px + env(safe-area-inset-bottom, 0px));
        }
        .voice-btn, .send-btn {
            width: 44px;
            height: 44px;
            min-width: 44px;
            min-height: 44px;
        }
        .chat-input input {
            padding: 12px 14px;
        }
    }

    /* Dark Mode */
    :global([data-theme="dark"]) .chat-window, :global([data-theme="amethyst"]) .chat-window, :global([data-theme="oled"]) .chat-window { background: rgba(28, 28, 30, 0.95); border-color: rgba(255, 255, 255, 0.1); }
    :global([data-theme="dark"]) .chat-messages, :global([data-theme="amethyst"]) .chat-messages, :global([data-theme="oled"]) .chat-messages { background: linear-gradient(180deg, rgba(0, 0, 0, 0.3) 0%, rgba(28, 28, 30, 0.5) 100%); }
    :global([data-theme="dark"]) .message.bot .message-bubble, :global([data-theme="amethyst"]) .message.bot .message-bubble, :global([data-theme="oled"]) .message.bot .message-bubble { background: rgba(44, 44, 46, 0.9); color: white; }
    :global([data-theme="dark"]) .message-card, :global([data-theme="dark"]) .message-stats, :global([data-theme="dark"]) .message-guide, :global([data-theme="dark"]) .message-list, :global([data-theme="dark"]) .message-quick-replies, :global([data-theme="amethyst"]) .message-card, :global([data-theme="amethyst"]) .message-stats, :global([data-theme="amethyst"]) .message-guide, :global([data-theme="amethyst"]) .message-list, :global([data-theme="amethyst"]) .message-quick-replies, :global([data-theme="oled"]) .message-card, :global([data-theme="oled"]) .message-stats, :global([data-theme="oled"]) .message-guide, :global([data-theme="oled"]) .message-list, :global([data-theme="oled"]) .message-quick-replies { background: rgba(44, 44, 46, 0.9); }
    :global([data-theme="dark"]) .stat-item, :global([data-theme="dark"]) .list-item, :global([data-theme="amethyst"]) .stat-item, :global([data-theme="amethyst"]) .list-item, :global([data-theme="oled"]) .stat-item, :global([data-theme="oled"]) .list-item { background: rgba(28, 28, 30, 0.8); }
    :global([data-theme="dark"]) .chat-input, :global([data-theme="dark"]) .suggestions-bar, :global([data-theme="dark"]) .ai-badge, :global([data-theme="amethyst"]) .chat-input, :global([data-theme="amethyst"]) .suggestions-bar, :global([data-theme="amethyst"]) .ai-badge, :global([data-theme="oled"]) .chat-input, :global([data-theme="oled"]) .suggestions-bar, :global([data-theme="oled"]) .ai-badge { background: rgba(28, 28, 30, 0.95); }
    :global([data-theme="dark"]) .chat-input input, :global([data-theme="amethyst"]) .chat-input input, :global([data-theme="oled"]) .chat-input input { background: rgba(44, 44, 46, 0.8); border-color: rgba(255, 255, 255, 0.1); color: white; }
    :global([data-theme="dark"]) .typing-indicator, :global([data-theme="amethyst"]) .typing-indicator, :global([data-theme="oled"]) .typing-indicator { background: rgba(44, 44, 46, 0.9); }
    :global([data-theme="dark"]) .scroll-bottom-btn, :global([data-theme="amethyst"]) .scroll-bottom-btn, :global([data-theme="oled"]) .scroll-bottom-btn { background: rgba(44, 44, 46, 0.9); border-color: rgba(255, 255, 255, 0.1); }
    :global([data-theme="dark"]) .chat-fab, :global([data-theme="amethyst"]) .chat-fab, :global([data-theme="oled"]) .chat-fab { background: rgba(44, 44, 46, 0.9); }

    /* Reduced Motion */
    @media (prefers-reduced-motion: reduce) { .chat-window, .message, .chat-fab, .typing-indicator span { animation: none !important; } }
</style>
