<script>
    import { onMount, onDestroy, tick } from 'svelte';
    import { browser } from '$app/environment';
    import { chatbotStore, MESSAGE_TYPES, CHATBOT_ROLES } from '$lib/stores/chatbot';
    import { sendMessage } from '$lib/services/chatbotService';
    import { IconX, IconSend, IconMinus, IconTrash, IconSparkles, IconChevronDown, IconRobot, IconMaximize } from '@tabler/icons-svelte';

    export let role = CHATBOT_ROLES.USER;
    export let userId = null;
    export let userProfile = null;

    let inputValue = '';
    let messagesContainer;
    let inputElement;
    let isAtBottom = true;
    let showScrollButton = false;

    $: isOpen = $chatbotStore.isOpen;
    $: isMinimized = $chatbotStore.isMinimized;
    $: messages = $chatbotStore.messages;
    $: isTyping = $chatbotStore.isTyping;
    $: unreadCount = $chatbotStore.unreadCount;
    $: suggestedQueries = $chatbotStore.suggestedQueries;
    $: isOnboarding = $chatbotStore.isOnboarding;

    onMount(() => { if (browser) chatbotStore.init(role, { userId, userProfile }); });
    onDestroy(() => { if (browser) chatbotStore.reset(); });

    async function scrollToBottom(smooth = true) {
        await tick();
        if (messagesContainer) { messagesContainer.scrollTo({ top: messagesContainer.scrollHeight, behavior: smooth ? 'smooth' : 'auto' }); isAtBottom = true; showScrollButton = false; }
    }

    function handleScroll() {
        if (messagesContainer) { const { scrollTop, scrollHeight, clientHeight } = messagesContainer; isAtBottom = scrollHeight - scrollTop - clientHeight < 50; showScrollButton = !isAtBottom && messages.length > 3; }
    }

    $: if (messages.length && isAtBottom) scrollToBottom();

    async function handleSend() {
        const message = inputValue.trim();
        if (!message || isTyping) return;
        chatbotStore.checkSession(); inputValue = ''; chatbotStore.addUserMessage(message);
        try {
            const response = await sendMessage(message, role, { userId, userProfile, sessionId: $chatbotStore.sessionId });
            await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 300));
            chatbotStore.addBotMessage(response);
            if (response.suggestedQueries) chatbotStore.updateSuggestions(response.suggestedQueries);
        } catch (error) { console.error('[Chatbot] Error:', error); chatbotStore.addBotMessage({ type: MESSAGE_TYPES.ERROR, content: "Sorry, I encountered an issue. Please try again." }); }
    }

    function handleKeydown(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }
    function handleQuickReply(query) { inputValue = query; handleSend(); }
    function handleAction(action) { if (action.href && action.href !== '#') { window.location.href = action.href; chatbotStore.close(); } else if (action.query) { inputValue = action.query; handleSend(); } else if (action.action) { chatbotStore.progressOnboarding(action.action); } }
    function handleSuggestionClick(query) { inputValue = query; handleSend(); }
    function formatTime(timestamp) { return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
</script>

{#if !isOpen}
<button class="chat-fab" class:has-unread={unreadCount > 0} on:click={() => chatbotStore.open()} aria-label="Open chat assistant">
    <div class="fab-icon"><IconRobot size={26} stroke={1.5} /></div>
    {#if unreadCount > 0}<span class="unread-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>{/if}
    <span class="fab-tooltip">{role === CHATBOT_ROLES.ADMIN ? 'Admin Assistant' : 'Need help?'}</span>
</button>
{/if}

{#if isOpen}
<div class="chat-window" class:minimized={isMinimized}>
    <div class="chat-header" class:admin={role === CHATBOT_ROLES.ADMIN}>
        <div class="header-info">
            <div class="bot-avatar"><IconSparkles size={18} stroke={1.5} /></div>
            <div class="header-text">
                <span class="bot-name">{role === CHATBOT_ROLES.ADMIN ? 'Admin Assistant' : 'Attendance Assistant'}</span>
                <span class="bot-status"><span class="status-dot"></span>Online</span>
            </div>
        </div>
        <div class="header-actions">
            <button class="header-btn" on:click={() => chatbotStore.clearMessages()} title="Clear"><IconTrash size={18} stroke={1.5} /></button>
            {#if isMinimized}<button class="header-btn" on:click={() => chatbotStore.restore()} title="Restore"><IconMaximize size={18} stroke={1.5} /></button>
            {:else}<button class="header-btn" on:click={() => chatbotStore.minimize()} title="Minimize"><IconMinus size={18} stroke={1.5} /></button>{/if}
            <button class="header-btn close" on:click={() => chatbotStore.close()} title="Close"><IconX size={18} stroke={1.5} /></button>
        </div>
    </div>
    {#if !isMinimized}
    <div class="chat-messages" bind:this={messagesContainer} on:scroll={handleScroll}>
        {#each messages as message (message.id)}
        <div class="message" class:user={message.sender === 'user'} class:bot={message.sender === 'bot'}>
            {#if message.type === MESSAGE_TYPES.TEXT || message.type === MESSAGE_TYPES.SYSTEM}
            <div class="message-bubble" class:system={message.type === MESSAGE_TYPES.SYSTEM}><p>{@html message.content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>')}</p></div>
            {:else if message.type === MESSAGE_TYPES.CARD}
            <div class="message-card" class:success={message.content.status === 'success'} class:warning={message.content.status === 'warning'} class:error={message.content.status === 'error'}>
                <div class="card-header"><span class="card-icon">{message.content.icon}</span><span class="card-title">{message.content.title}</span></div>
                <p class="card-description">{@html message.content.description.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>')}</p>
                {#if message.content.details}<p class="card-details">{message.content.details}</p>{/if}
                {#if message.content.actions}<div class="card-actions">{#each message.content.actions as action}<button class="card-action-btn" on:click={() => handleAction(action)}>{action.label}</button>{/each}</div>{/if}
            </div>
            {:else if message.type === MESSAGE_TYPES.STATS}
            <div class="message-stats">
                <p class="stats-title">{message.content.title}</p>
                {#if message.content.subtitle}<p class="stats-subtitle">{message.content.subtitle}</p>{/if}
                <div class="stats-grid">{#each message.content.stats as stat}<div class="stat-item" class:green={stat.color === 'green'} class:yellow={stat.color === 'yellow'} class:red={stat.color === 'red'}><span class="stat-icon">{stat.icon}</span><span class="stat-value">{stat.value}</span><span class="stat-label">{stat.label}</span></div>{/each}</div>
                {#if message.content.note}<p class="stats-note">{message.content.note}</p>{/if}
            </div>
            {:else if message.type === MESSAGE_TYPES.GUIDE}
            <div class="message-guide">
                <p class="guide-title">{message.content.title}</p>
                {#each message.content.sections as section}<div class="guide-section"><p class="section-heading">{section.heading}</p><p class="section-text">{@html section.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>')}</p></div>{/each}
                {#if message.content.actions}<div class="guide-actions">{#each message.content.actions as action}<button class="guide-action-btn" on:click={() => handleAction(action)}>{action.label}</button>{/each}</div>{/if}
            </div>
            {:else if message.type === MESSAGE_TYPES.LIST}
            <div class="message-list" class:warning={message.content.status === 'warning'} class:error={message.content.status === 'error'}>
                <div class="list-header"><span class="list-icon">{message.content.icon}</span><div class="list-titles"><span class="list-title">{message.content.title}</span>{#if message.content.subtitle}<span class="list-subtitle">{message.content.subtitle}</span>{/if}</div></div>
                <div class="list-items">{#each message.content.items as item}<div class="list-item"><span class="item-primary">{item.primary}</span>{#if item.secondary}<span class="item-secondary">{item.secondary}</span>{/if}</div>{/each}</div>
                {#if message.content.note}<p class="list-note">{message.content.note}</p>{/if}
                {#if message.content.actions}<div class="list-actions">{#each message.content.actions as action}<button class="list-action-btn" on:click={() => handleAction(action)}>{action.label}</button>{/each}</div>{/if}
            </div>
            {:else if message.type === MESSAGE_TYPES.QUICK_REPLIES}
            <div class="message-quick-replies"><p class="quick-title">{message.content.title}</p><div class="quick-options">{#each message.content.options as option}<button class="quick-btn" on:click={() => handleQuickReply(option.query)}>{option.label}</button>{/each}</div></div>
            {:else if message.type === MESSAGE_TYPES.ONBOARDING}
            <div class="message-onboarding">
                <div class="onboarding-header"><span class="onboarding-step">Getting Started</span>{#if message.content.progress}<span class="onboarding-progress">{message.content.progress}/{message.content.totalSteps}</span>{/if}</div>
                <p class="onboarding-title">{message.content.title}</p><p class="onboarding-description">{message.content.description}</p>
                {#if message.content.actions}<div class="onboarding-actions">{#each message.content.actions as action}<button class="onboarding-btn" class:primary={action.action === 'next'} class:secondary={action.action === 'skip'} on:click={() => handleAction(action)}>{action.label}</button>{/each}</div>{/if}
            </div>
            {:else if message.type === MESSAGE_TYPES.ERROR}
            <div class="message-bubble error"><p>{message.content}</p></div>
            {/if}
            <span class="message-time">{formatTime(message.timestamp)}</span>
        </div>
        {/each}
        {#if isTyping}<div class="message bot"><div class="typing-indicator"><span></span><span></span><span></span></div></div>{/if}
    </div>
    {#if showScrollButton}<button class="scroll-bottom-btn" on:click={() => scrollToBottom()}><IconChevronDown size={20} stroke={2} /></button>{/if}
    {#if suggestedQueries.length > 0 && messages.length <= 2 && !isOnboarding}<div class="suggestions-bar">{#each suggestedQueries as suggestion}<button class="suggestion-chip" on:click={() => handleSuggestionClick(suggestion.query)}>{suggestion.label}</button>{/each}</div>{/if}
    <div class="chat-input">
        <input type="text" bind:value={inputValue} bind:this={inputElement} on:keydown={handleKeydown} placeholder={isOnboarding ? "Complete the tour first..." : "Type your message..."} disabled={isTyping || isOnboarding} />
        <button class="send-btn" on:click={handleSend} disabled={!inputValue.trim() || isTyping || isOnboarding} aria-label="Send"><IconSend size={20} stroke={1.5} /></button>
    </div>
    {/if}
</div>
{/if}


<style>
    .chat-fab { position: fixed; bottom: 24px; right: 24px; width: 60px; height: 60px; border-radius: 50%; background: linear-gradient(135deg, var(--apple-accent, #007AFF), #5856D6); color: white; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 24px rgba(0, 122, 255, 0.4); transition: all 0.3s cubic-bezier(0.25, 0.1, 0.25, 1); z-index: 1000; }
    .chat-fab:hover { transform: scale(1.08) translateY(-2px); box-shadow: 0 8px 32px rgba(0, 122, 255, 0.5); }
    .chat-fab:active { transform: scale(0.95); }
    .chat-fab.has-unread { animation: pulse 2s infinite; }
    @keyframes pulse { 0%, 100% { box-shadow: 0 4px 24px rgba(0, 122, 255, 0.4); } 50% { box-shadow: 0 4px 32px rgba(0, 122, 255, 0.6); } }
    .fab-icon { display: flex; align-items: center; justify-content: center; }
    .unread-badge { position: absolute; top: -4px; right: -4px; min-width: 20px; height: 20px; background: var(--apple-red, #FF3B30); color: white; font-size: 11px; font-weight: 600; border-radius: 10px; display: flex; align-items: center; justify-content: center; padding: 0 6px; }
    .fab-tooltip { position: absolute; right: 70px; background: var(--theme-card-bg, white); color: var(--theme-text, #1d1d1f); padding: 8px 12px; border-radius: 8px; font-size: 13px; font-weight: 500; white-space: nowrap; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12); opacity: 0; pointer-events: none; transition: opacity 0.2s; }
    .chat-fab:hover .fab-tooltip { opacity: 1; }
    .chat-window { position: fixed; bottom: 24px; right: 24px; width: 380px; max-width: calc(100vw - 48px); height: 560px; max-height: calc(100vh - 100px); background: var(--theme-card-bg, white); border-radius: 20px; box-shadow: 0 8px 40px rgba(0, 0, 0, 0.15); display: flex; flex-direction: column; overflow: hidden; z-index: 1001; animation: slideUp 0.3s cubic-bezier(0.25, 0.1, 0.25, 1); }
    .chat-window.minimized { height: auto; }
    @keyframes slideUp { from { opacity: 0; transform: translateY(20px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
    .chat-header { display: flex; align-items: center; justify-content: space-between; padding: 16px; background: linear-gradient(135deg, var(--apple-accent, #007AFF), #5856D6); color: white; }
    .chat-header.admin { background: linear-gradient(135deg, #5856D6, #AF52DE); }
    .header-info { display: flex; align-items: center; gap: 12px; }
    .bot-avatar { width: 36px; height: 36px; background: rgba(255, 255, 255, 0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; }
    .header-text { display: flex; flex-direction: column; }
    .bot-name { font-size: 15px; font-weight: 600; }
    .bot-status { font-size: 12px; opacity: 0.9; display: flex; align-items: center; gap: 6px; }
    .status-dot { width: 8px; height: 8px; background: #34C759; border-radius: 50%; }
    .header-actions { display: flex; gap: 4px; }
    .header-btn { width: 32px; height: 32px; border: none; background: rgba(255, 255, 255, 0.15); color: white; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s; }
    .header-btn:hover { background: rgba(255, 255, 255, 0.25); }
    .header-btn.close:hover { background: rgba(255, 59, 48, 0.8); }
    .chat-messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; background: var(--theme-bg, #f5f5f7); }
    .message { display: flex; flex-direction: column; max-width: 85%; }
    .message.user { align-self: flex-end; }
    .message.bot { align-self: flex-start; }
    .message-time { font-size: 10px; color: var(--theme-text-secondary, #86868b); margin-top: 4px; padding: 0 4px; }
    .message.user .message-time { text-align: right; }
    .message-bubble { padding: 12px 16px; border-radius: 18px; font-size: 14px; line-height: 1.5; }
    .message-bubble p { margin: 0; }
    .message.user .message-bubble { background: var(--apple-accent, #007AFF); color: white; border-bottom-right-radius: 4px; }
    .message.bot .message-bubble { background: var(--theme-card-bg, white); color: var(--theme-text, #1d1d1f); border-bottom-left-radius: 4px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08); }
    .message-bubble.system { background: var(--theme-border-light, #e5e5ea); font-style: italic; }
    .message-bubble.error { background: rgba(255, 59, 48, 0.1); color: var(--apple-red, #FF3B30); }
    .message-card { background: var(--theme-card-bg, white); border-radius: 16px; padding: 16px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08); border-left: 4px solid var(--apple-accent, #007AFF); }
    .message-card.success { border-left-color: var(--apple-green, #34C759); }
    .message-card.warning { border-left-color: var(--apple-orange, #FF9500); }
    .message-card.error { border-left-color: var(--apple-red, #FF3B30); }
    .card-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .card-icon { font-size: 20px; }
    .card-title { font-size: 15px; font-weight: 600; color: var(--theme-text, #1d1d1f); }
    .card-description { font-size: 14px; color: var(--theme-text, #1d1d1f); line-height: 1.5; margin: 0; }
    .card-details { font-size: 12px; color: var(--theme-text-secondary, #86868b); margin-top: 8px; }
    .card-actions { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
    .card-action-btn { padding: 8px 14px; background: var(--apple-accent, #007AFF); color: white; border: none; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.2s; }
    .card-action-btn:hover { background: #0056b3; transform: translateY(-1px); }
    .message-stats { background: var(--theme-card-bg, white); border-radius: 16px; padding: 16px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08); }
    .stats-title { font-size: 15px; font-weight: 600; color: var(--theme-text, #1d1d1f); margin: 0 0 4px 0; }
    .stats-subtitle { font-size: 12px; color: var(--theme-text-secondary, #86868b); margin: 0 0 12px 0; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(70px, 1fr)); gap: 8px; }
    .stat-item { background: var(--theme-bg, #f5f5f7); padding: 10px 8px; border-radius: 10px; text-align: center; }
    .stat-item.green { background: rgba(52, 199, 89, 0.1); }
    .stat-item.yellow { background: rgba(255, 149, 0, 0.1); }
    .stat-item.red { background: rgba(255, 59, 48, 0.1); }
    .stat-icon { font-size: 16px; display: block; margin-bottom: 4px; }
    .stat-value { font-size: 18px; font-weight: 700; color: var(--theme-text, #1d1d1f); display: block; }
    .stat-label { font-size: 10px; color: var(--theme-text-secondary, #86868b); display: block; margin-top: 2px; }
    .stats-note { font-size: 12px; color: var(--theme-text-secondary, #86868b); margin: 12px 0 0 0; padding-top: 12px; border-top: 1px solid var(--theme-border-light, #e5e5ea); }
    .message-guide { background: var(--theme-card-bg, white); border-radius: 16px; padding: 16px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08); }
    .guide-title { font-size: 15px; font-weight: 600; color: var(--theme-text, #1d1d1f); margin: 0 0 12px 0; }
    .guide-section { margin-bottom: 12px; }
    .guide-section:last-of-type { margin-bottom: 0; }
    .section-heading { font-size: 13px; font-weight: 600; color: var(--apple-accent, #007AFF); margin: 0 0 4px 0; }
    .section-text { font-size: 13px; color: var(--theme-text, #1d1d1f); line-height: 1.5; margin: 0; }
    .guide-actions { display: flex; gap: 8px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--theme-border-light, #e5e5ea); flex-wrap: wrap; }
    .guide-action-btn { padding: 8px 14px; background: var(--theme-bg, #f5f5f7); color: var(--apple-accent, #007AFF); border: 1px solid var(--theme-border, #d1d1d6); border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.2s; }
    .guide-action-btn:hover { background: var(--apple-accent, #007AFF); color: white; border-color: var(--apple-accent, #007AFF); }
    .message-list { background: var(--theme-card-bg, white); border-radius: 16px; padding: 16px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08); border-left: 4px solid var(--apple-accent, #007AFF); }
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
    .list-action-btn { padding: 8px 14px; background: var(--apple-accent, #007AFF); color: white; border: none; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.2s; }
    .list-action-btn:hover { background: #0056b3; }
    .message-quick-replies { background: var(--theme-card-bg, white); border-radius: 16px; padding: 16px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08); }
    .quick-title { font-size: 14px; color: var(--theme-text, #1d1d1f); margin: 0 0 12px 0; }
    .quick-options { display: flex; flex-wrap: wrap; gap: 8px; }
    .quick-btn { padding: 8px 12px; background: var(--theme-bg, #f5f5f7); color: var(--theme-text, #1d1d1f); border: 1px solid var(--theme-border, #d1d1d6); border-radius: 16px; font-size: 12px; cursor: pointer; transition: all 0.2s; }
    .quick-btn:hover { background: var(--apple-accent, #007AFF); color: white; border-color: var(--apple-accent, #007AFF); }
    .message-onboarding { background: linear-gradient(135deg, var(--apple-accent, #007AFF), #5856D6); border-radius: 16px; padding: 20px; color: white; }
    .onboarding-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .onboarding-step { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.9; }
    .onboarding-progress { font-size: 12px; background: rgba(255, 255, 255, 0.2); padding: 4px 10px; border-radius: 12px; }
    .onboarding-title { font-size: 18px; font-weight: 600; margin: 0 0 8px 0; }
    .onboarding-description { font-size: 14px; line-height: 1.5; opacity: 0.95; margin: 0; }
    .onboarding-actions { display: flex; gap: 10px; margin-top: 16px; }
    .onboarding-btn { padding: 10px 20px; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; border: none; }
    .onboarding-btn.primary { background: white; color: var(--apple-accent, #007AFF); }
    .onboarding-btn.primary:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); }
    .onboarding-btn.secondary { background: rgba(255, 255, 255, 0.2); color: white; }
    .onboarding-btn.secondary:hover { background: rgba(255, 255, 255, 0.3); }
    .typing-indicator { display: flex; gap: 4px; padding: 12px 16px; background: var(--theme-card-bg, white); border-radius: 18px; border-bottom-left-radius: 4px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08); }
    .typing-indicator span { width: 8px; height: 8px; background: var(--theme-text-secondary, #86868b); border-radius: 50%; animation: typing 1.4s infinite ease-in-out; }
    .typing-indicator span:nth-child(1) { animation-delay: 0s; }
    .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
    .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes typing { 0%, 60%, 100% { transform: translateY(0); opacity: 0.4; } 30% { transform: translateY(-4px); opacity: 1; } }
    .scroll-bottom-btn { position: absolute; bottom: 80px; left: 50%; transform: translateX(-50%); width: 36px; height: 36px; background: var(--theme-card-bg, white); border: 1px solid var(--theme-border, #d1d1d6); border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1); color: var(--theme-text-secondary, #86868b); transition: all 0.2s; z-index: 10; }
    .scroll-bottom-btn:hover { background: var(--apple-accent, #007AFF); color: white; border-color: var(--apple-accent, #007AFF); }
    .suggestions-bar { display: flex; gap: 8px; padding: 12px 16px; overflow-x: auto; background: var(--theme-card-bg, white); border-top: 1px solid var(--theme-border-light, #e5e5ea); }
    .suggestions-bar::-webkit-scrollbar { display: none; }
    .suggestion-chip { padding: 8px 14px; background: var(--theme-bg, #f5f5f7); color: var(--apple-accent, #007AFF); border: 1px solid var(--theme-border, #d1d1d6); border-radius: 16px; font-size: 12px; font-weight: 500; white-space: nowrap; cursor: pointer; transition: all 0.2s; }
    .suggestion-chip:hover { background: var(--apple-accent, #007AFF); color: white; border-color: var(--apple-accent, #007AFF); }
    .chat-input { display: flex; gap: 10px; padding: 12px 16px; background: var(--theme-card-bg, white); border-top: 1px solid var(--theme-border-light, #e5e5ea); }
    .chat-input input { flex: 1; padding: 12px 16px; background: var(--theme-bg, #f5f5f7); border: 1px solid var(--theme-border, #d1d1d6); border-radius: 24px; font-size: 14px; color: var(--theme-text, #1d1d1f); outline: none; transition: all 0.2s; }
    .chat-input input:focus { border-color: var(--apple-accent, #007AFF); box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1); }
    .chat-input input:disabled { opacity: 0.6; cursor: not-allowed; }
    .chat-input input::placeholder { color: var(--theme-text-secondary, #86868b); }
    .send-btn { width: 44px; height: 44px; background: var(--apple-accent, #007AFF); color: white; border: none; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; flex-shrink: 0; }
    .send-btn:hover:not(:disabled) { background: #0056b3; transform: scale(1.05); }
    .send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    @media (max-width: 480px) { .chat-fab { bottom: 90px; right: 16px; width: 54px; height: 54px; } .chat-window { bottom: 0; right: 0; left: 0; width: 100%; max-width: 100%; height: calc(100vh - 60px); max-height: calc(100vh - 60px); border-radius: 20px 20px 0 0; } .fab-tooltip { display: none; } .quick-options { max-height: 120px; overflow-y: auto; } }
    :global(.dark) .chat-window { background: var(--theme-card-bg, #1c1c1e); }
    :global(.dark) .chat-messages { background: var(--theme-bg, #000); }
    :global(.dark) .message.bot .message-bubble { background: var(--theme-card-bg, #2c2c2e); }
    :global(.dark) .message-card, :global(.dark) .message-stats, :global(.dark) .message-guide, :global(.dark) .message-list, :global(.dark) .message-quick-replies { background: var(--theme-card-bg, #2c2c2e); }
    :global(.dark) .stat-item, :global(.dark) .list-item { background: var(--theme-bg, #1c1c1e); }
    :global(.dark) .chat-input { background: var(--theme-card-bg, #1c1c1e); }
    :global(.dark) .chat-input input { background: var(--theme-bg, #2c2c2e); border-color: var(--theme-border, #3a3a3c); }
</style>
