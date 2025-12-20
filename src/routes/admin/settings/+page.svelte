<script>
    import { onMount } from "svelte";
    import { adminAuthStore } from "$lib/stores/adminAuth.js";
    import { 
        IconSettings, IconLoader2, IconCheck, IconDeviceFloppy, IconPlus, IconTrash, 
        IconClock, IconBuilding, IconSchool, IconId, IconPalette, IconCalendar,
        IconShield, IconRefresh, IconPhoto, IconSun, IconMoon, IconSnowflake,
        IconPumpkinScary, IconAlertTriangle, IconQrcode, IconEye, IconEyeOff,
        IconDeviceDesktop, IconSparkles, IconDroplet, IconLeaf, IconFlame
    } from "@tabler/icons-svelte";

    let settings = {
        general: { siteName: 'Student Attendance', timezone: 'Asia/Manila', dateFormat: 'MM/DD/YYYY' },
        attendance: { 
            startTime: '08:00',
            endTime: '17:00',
            autoCheckout: true, 
            autoCheckoutTime: '18:00', 
            lateThreshold: 15, 
            gracePeriod: 15,
            geofenceEnabled: true,
            workDays: [1, 2, 3, 4, 5],
            holidayAutoMark: true,
            weekendAutoMark: true
        },
        epass: {
            qrExpiration: 30,
            animatedHologram: true,
            antiScreenshot: true,
            watermarkEnabled: true
        },
        theme: {
            accentColor: '#007AFF',
            themeMode: 'light',
            logoUrl: '',
            seasonalTheme: 'none',
            welcomeBanner: { enabled: false, title: '', message: '', imageUrl: '' }
        },
        security: { sessionTimeout: 8, maxLoginAttempts: 5, mfaRequired: false }
    };
    
    let departments = [];
    let years = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year'];
    let sections = ['A', 'B', 'C', 'D', 'E', 'F'];
    let holidays = [];
    
    let newDepartment = '';
    let newYear = '';
    let newSection = '';
    let newHoliday = { name: '', date: '' };
    
    let isLoading = true;
    let isSaving = false;
    let saveSuccess = false;
    let activeTab = 'attendance';
    let isRegeneratingQR = false;
    let logoPreview = null;
    let bannerPreview = null;

    const tabs = [
        { id: 'attendance', label: 'Attendance Rules', icon: IconClock },
        { id: 'epass', label: 'E-Pass / Digital ID', icon: IconId },
        { id: 'departments', label: 'Departments', icon: IconBuilding },
        { id: 'academic', label: 'Academic', icon: IconSchool },
        { id: 'theme', label: 'UI Theme', icon: IconPalette },
        { id: 'security', label: 'Security', icon: IconShield }
    ];

    const weekDays = [
        { id: 0, label: 'Sun' }, { id: 1, label: 'Mon' }, { id: 2, label: 'Tue' },
        { id: 3, label: 'Wed' }, { id: 4, label: 'Thu' }, { id: 5, label: 'Fri' }, { id: 6, label: 'Sat' }
    ];

    const seasonalThemes = [
        { id: 'none', label: 'None', icon: IconSun },
        { id: 'christmas', label: 'Christmas', icon: IconSnowflake, color: '#c41e3a' },
        { id: 'halloween', label: 'Halloween', icon: IconPumpkinScary, color: '#ff6600' },
        { id: 'dark', label: 'Dark Mode', icon: IconMoon, color: '#1c1c1e' }
    ];

    const accentColors = [
        { id: '#007AFF', label: 'Blue' }, { id: '#34C759', label: 'Green' },
        { id: '#FF9500', label: 'Orange' }, { id: '#AF52DE', label: 'Purple' },
        { id: '#FF3B30', label: 'Red' }, { id: '#5856D6', label: 'Indigo' },
        { id: '#FF2D55', label: 'Pink' }, { id: '#00C7BE', label: 'Teal' }
    ];

    // Theme modes for system-wide appearance
    const themeModes = [
        { id: 'light', name: 'Light', desc: 'Clean & bright', icon: IconSun, bg: '#F5F5F7', iconColor: '#0A0A0A' },
        { id: 'dark', name: 'Dark', desc: 'Easy on the eyes', icon: IconMoon, bg: '#1C1C1E', iconColor: '#FFFFFF' },
        { id: 'amethyst', name: 'Amethyst', desc: 'Purple vibes', icon: IconSparkles, bg: '#1A1625', iconColor: '#AF52DE' },
        { id: 'oled', name: 'OLED Black', desc: 'Pure black', icon: IconDeviceDesktop, bg: '#000000', iconColor: '#FFFFFF' },
        { id: 'midnight', name: 'Midnight', desc: 'Deep blue', icon: IconMoon, bg: '#0D1B2A', iconColor: '#778DA9' },
        { id: 'forest', name: 'Forest', desc: 'Nature green', icon: IconLeaf, bg: '#1A2F1A', iconColor: '#81C784' },
        { id: 'sunset', name: 'Sunset', desc: 'Warm tones', icon: IconFlame, bg: '#2D1B1B', iconColor: '#FFAB91' },
        { id: 'ocean', name: 'Ocean', desc: 'Cool blue', icon: IconDroplet, bg: '#0A1929', iconColor: '#5090D3' }
    ];

    onMount(async () => { await loadSettings(); });

    async function loadSettings() {
        isLoading = true;
        try {
            const { accessToken } = adminAuthStore.getStoredTokens();
            const response = await fetch('/api/admin/settings', {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            if (response.ok) {
                const data = await response.json();
                if (data.settings) {
                    settings = { 
                        general: { ...settings.general, ...data.settings.general },
                        attendance: { ...settings.attendance, ...data.settings.attendance },
                        epass: { ...settings.epass, ...data.settings.epass },
                        theme: { ...settings.theme, ...data.settings.theme },
                        security: { ...settings.security, ...data.settings.security }
                    };
                    departments = data.settings.departments || [];
                    years = data.settings.years || years;
                    sections = data.settings.sections || sections;
                    holidays = data.settings.holidays || [];
                    if (settings.theme.logoUrl) logoPreview = settings.theme.logoUrl;
                    if (settings.theme.welcomeBanner?.imageUrl) bannerPreview = settings.theme.welcomeBanner.imageUrl;
                }
            }
        } catch (error) { console.error('Failed to load settings:', error); }
        finally { isLoading = false; }
    }

    async function saveSettings() {
        isSaving = true; saveSuccess = false;
        try {
            const { accessToken } = adminAuthStore.getStoredTokens();
            const response = await fetch('/api/admin/settings', {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ settings: { ...settings, departments, years, sections, holidays } })
            });
            if (response.ok) { 
                saveSuccess = true; 
                setTimeout(() => saveSuccess = false, 3000);
                
                // Immediately apply theme changes
                applyThemeChanges();
            }
        } catch (error) { console.error('Failed to save settings:', error); }
        finally { isSaving = false; }
    }
    
    // Apply theme changes immediately after save
    function applyThemeChanges() {
        if (typeof window === 'undefined') return;
        
        const root = document.documentElement;
        
        // Apply accent color
        if (settings.theme.accentColor) {
            root.style.setProperty('--apple-accent', settings.theme.accentColor);
            root.style.setProperty('--apple-accent-hover', adjustColorBrightness(settings.theme.accentColor, -20));
        }
        
        // Apply theme mode
        if (settings.theme.themeMode) {
            const themeColors = {
                light: { bg: '#F5F5F7', cardBg: '#FFFFFF', text: '#0A0A0A', textSecondary: '#8E8E93', border: '#D1D1D6', borderLight: '#E5E5EA' },
                dark: { bg: '#1C1C1E', cardBg: '#2C2C2E', text: '#FFFFFF', textSecondary: '#8E8E93', border: '#3A3A3C', borderLight: '#48484A' },
                amethyst: { bg: '#1A1625', cardBg: '#252033', text: '#FFFFFF', textSecondary: '#9D8EC9', border: '#3D3456', borderLight: '#4A4066' },
                oled: { bg: '#000000', cardBg: '#0A0A0A', text: '#FFFFFF', textSecondary: '#8E8E93', border: '#1C1C1E', borderLight: '#2C2C2E' },
                midnight: { bg: '#0D1B2A', cardBg: '#1B263B', text: '#E0E1DD', textSecondary: '#778DA9', border: '#415A77', borderLight: '#1B263B' },
                forest: { bg: '#1A2F1A', cardBg: '#243524', text: '#E8F5E9', textSecondary: '#81C784', border: '#2E7D32', borderLight: '#1B5E20' },
                sunset: { bg: '#2D1B1B', cardBg: '#3D2525', text: '#FFE0B2', textSecondary: '#FFAB91', border: '#5D4037', borderLight: '#4E342E' },
                ocean: { bg: '#0A1929', cardBg: '#132F4C', text: '#B2BAC2', textSecondary: '#5090D3', border: '#1E4976', borderLight: '#173A5E' }
            };
            
            const theme = themeColors[settings.theme.themeMode] || themeColors.light;
            root.style.setProperty('--theme-bg', theme.bg);
            root.style.setProperty('--theme-card-bg', theme.cardBg);
            root.style.setProperty('--theme-text', theme.text);
            root.style.setProperty('--theme-text-secondary', theme.textSecondary);
            root.style.setProperty('--theme-border', theme.border);
            root.style.setProperty('--theme-border-light', theme.borderLight);
            root.setAttribute('data-theme', settings.theme.themeMode);
        }
        
        // Apply seasonal theme
        if (settings.theme.seasonalTheme && settings.theme.seasonalTheme !== 'none') {
            document.body.setAttribute('data-seasonal-theme', settings.theme.seasonalTheme);
        } else {
            document.body.removeAttribute('data-seasonal-theme');
        }
        
        // Update localStorage cache so other pages pick up the change
        localStorage.setItem('systemSettings', JSON.stringify({ ...settings, departments, years, sections, holidays }));
    }
    
    function adjustColorBrightness(hex, amount) {
        const num = parseInt(hex.replace('#', ''), 16);
        const r = Math.min(255, Math.max(0, (num >> 16) + amount));
        const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
        const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));
        return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
    }

    async function regenerateAllQRCodes() {
        if (!confirm('This will regenerate QR codes for ALL users. Continue?')) return;
        isRegeneratingQR = true;
        try {
            const { accessToken } = adminAuthStore.getStoredTokens();
            await fetch('/api/admin/settings/regenerate-qr', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            alert('QR codes regeneration started. Users will receive new codes.');
        } catch (error) { console.error('Failed to regenerate QR codes:', error); }
        finally { isRegeneratingQR = false; }
    }

    function addDepartment() {
        if (newDepartment.trim() && !departments.includes(newDepartment.trim())) {
            departments = [...departments, newDepartment.trim()]; newDepartment = '';
        }
    }
    function removeDepartment(dept) { departments = departments.filter(d => d !== dept); }

    function addYear() {
        if (newYear.trim() && !years.includes(newYear.trim())) {
            years = [...years, newYear.trim()]; newYear = '';
        }
    }
    function removeYear(year) { years = years.filter(y => y !== year); }

    function addSection() {
        if (newSection.trim() && !sections.includes(newSection.trim())) {
            sections = [...sections, newSection.trim()]; newSection = '';
        }
    }
    function removeSection(section) { sections = sections.filter(s => s !== section); }

    function addHoliday() {
        if (newHoliday.name.trim() && newHoliday.date) {
            holidays = [...holidays, { ...newHoliday, id: Date.now() }];
            newHoliday = { name: '', date: '' };
        }
    }
    function removeHoliday(id) { holidays = holidays.filter(h => h.id !== id); }

    function toggleWorkDay(dayId) {
        if (settings.attendance.workDays.includes(dayId)) {
            settings.attendance.workDays = settings.attendance.workDays.filter(d => d !== dayId);
        } else {
            settings.attendance.workDays = [...settings.attendance.workDays, dayId].sort();
        }
    }

    async function handleLogoUpload(event) {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => { logoPreview = e.target.result; settings.theme.logoUrl = e.target.result; };
        reader.readAsDataURL(file);
    }

    async function handleBannerUpload(event) {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => { bannerPreview = e.target.result; settings.theme.welcomeBanner.imageUrl = e.target.result; };
        reader.readAsDataURL(file);
    }

    function formatHolidayDate(dateStr) {
        return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
</script>

<svelte:head><title>System Settings | Admin Panel</title></svelte:head>

<div class="settings-page">
    <header class="page-header">
        <div class="header-content">
            <h1><IconSettings size={28} stroke={1.5} /> System Settings</h1>
            <p class="header-subtitle">Configure attendance rules, E-Pass, departments, and themes</p>
        </div>
        <button class="apple-btn-primary" on:click={saveSettings} disabled={isSaving}>
            {#if isSaving}<IconLoader2 size={18} stroke={2} class="spin" /> Saving...
            {:else if saveSuccess}<IconCheck size={18} stroke={2} /> Saved!
            {:else}<IconDeviceFloppy size={18} stroke={2} /> Save Changes{/if}
        </button>
    </header>

    {#if isLoading}
        <div class="loading-state apple-card"><IconLoader2 size={32} stroke={1.5} class="spin" /><p>Loading settings...</p></div>
    {:else}
        <div class="settings-layout">
            <div class="settings-tabs">
                {#each tabs as tab}
                    <button class="tab-btn" class:active={activeTab === tab.id} on:click={() => activeTab = tab.id}>
                        <svelte:component this={tab.icon} size={18} stroke={1.5} /> {tab.label}
                    </button>
                {/each}
            </div>

            <div class="settings-content apple-card">
                <!-- 5.1 Attendance Rules -->
                {#if activeTab === 'attendance'}
                    <h2>Attendance Rules</h2>
                    
                    <div class="form-section">
                        <h3><IconClock size={18} /> Time-in Schedule</h3>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="apple-label">Start Time</label>
                                <input type="time" class="apple-input" bind:value={settings.attendance.startTime} />
                            </div>
                            <div class="form-group">
                                <label class="apple-label">End Time</label>
                                <input type="time" class="apple-input" bind:value={settings.attendance.endTime} />
                            </div>
                        </div>
                    </div>

                    <div class="form-section">
                        <h3>Grace Periods & Thresholds</h3>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="apple-label">Grace Period (minutes)</label>
                                <input type="number" class="apple-input" bind:value={settings.attendance.gracePeriod} min="0" max="60" />
                                <p class="form-hint">Time after start before marking late</p>
                            </div>
                            <div class="form-group">
                                <label class="apple-label">Late Threshold (minutes)</label>
                                <input type="number" class="apple-input" bind:value={settings.attendance.lateThreshold} min="0" max="120" />
                                <p class="form-hint">Minutes late to be marked as late</p>
                            </div>
                        </div>
                    </div>

                    <div class="form-section">
                        <h3><IconCalendar size={18} /> Holiday Auto-Marking</h3>
                        <div class="form-group toggle-group">
                            <label class="toggle-label">
                                <span>Auto-mark holidays as non-attendance days</span>
                                <input type="checkbox" bind:checked={settings.attendance.holidayAutoMark} />
                                <span class="toggle-switch"></span>
                            </label>
                        </div>
                        
                        <div class="holiday-manager">
                            <h4>Manage Holidays</h4>
                            <div class="add-item-row">
                                <input type="text" class="apple-input" placeholder="Holiday name" bind:value={newHoliday.name} />
                                <input type="date" class="apple-input date-input" bind:value={newHoliday.date} />
                                <button class="apple-btn-secondary" on:click={addHoliday}><IconPlus size={16} /> Add</button>
                            </div>
                            <div class="items-list">
                                {#if holidays.length === 0}
                                    <p class="empty-text">No holidays configured</p>
                                {:else}
                                    {#each holidays as holiday}
                                        <div class="list-item">
                                            <span class="holiday-name">{holiday.name}</span>
                                            <span class="holiday-date">{formatHolidayDate(holiday.date)}</span>
                                            <button class="remove-btn" on:click={() => removeHoliday(holiday.id)}><IconTrash size={16} /></button>
                                        </div>
                                    {/each}
                                {/if}
                            </div>
                        </div>
                    </div>

                    <div class="form-section">
                        <h3>Weekend Controls</h3>
                        <div class="form-group toggle-group">
                            <label class="toggle-label">
                                <span>Auto-mark weekends as non-attendance</span>
                                <input type="checkbox" bind:checked={settings.attendance.weekendAutoMark} />
                                <span class="toggle-switch"></span>
                            </label>
                        </div>
                        <div class="form-group">
                            <label class="apple-label">Work Days</label>
                            <div class="weekday-selector">
                                {#each weekDays as day}
                                    <button class="weekday-btn" class:active={settings.attendance.workDays.includes(day.id)} on:click={() => toggleWorkDay(day.id)}>{day.label}</button>
                                {/each}
                            </div>
                        </div>
                    </div>

                    <div class="form-section">
                        <h3>Auto Checkout</h3>
                        <div class="form-group toggle-group">
                            <label class="toggle-label">
                                <span>Enable Auto Checkout</span>
                                <input type="checkbox" bind:checked={settings.attendance.autoCheckout} />
                                <span class="toggle-switch"></span>
                            </label>
                        </div>
                        {#if settings.attendance.autoCheckout}
                            <div class="form-group">
                                <label class="apple-label">Auto Checkout Time</label>
                                <input type="time" class="apple-input" bind:value={settings.attendance.autoCheckoutTime} />
                            </div>
                        {/if}
                    </div>

                <!-- 5.2 E-Pass / Digital ID Settings -->
                {:else if activeTab === 'epass'}
                    <h2><IconId size={22} /> Digital ID (E-Pass) Settings</h2>
                    
                    <div class="form-section">
                        <h3><IconQrcode size={18} /> QR Code Settings</h3>
                        <div class="form-group">
                            <label class="apple-label">QR Code Expiration (seconds)</label>
                            <input type="number" class="apple-input" bind:value={settings.epass.qrExpiration} min="10" max="300" />
                            <p class="form-hint">How long before QR code refreshes (10-300 seconds)</p>
                        </div>
                        
                        <div class="action-card">
                            <div class="action-info">
                                <h4>Regenerate All QR Codes</h4>
                                <p>Generate new QR codes for all users. Use this if security is compromised.</p>
                            </div>
                            <button class="apple-btn-danger" on:click={regenerateAllQRCodes} disabled={isRegeneratingQR}>
                                {#if isRegeneratingQR}<IconLoader2 size={16} class="spin" /> Regenerating...
                                {:else}<IconRefresh size={16} /> Regenerate All{/if}
                            </button>
                        </div>
                    </div>

                    <div class="form-section">
                        <h3><IconShield size={18} /> Security Features</h3>
                        <div class="form-group toggle-group">
                            <label class="toggle-label">
                                <span>Animated Hologram Effect</span>
                                <input type="checkbox" bind:checked={settings.epass.animatedHologram} />
                                <span class="toggle-switch"></span>
                            </label>
                            <p class="form-hint">Adds animated holographic overlay to prevent static screenshots</p>
                        </div>
                        
                        <div class="form-group toggle-group">
                            <label class="toggle-label">
                                <span>Anti-Screenshot Watermark</span>
                                <input type="checkbox" bind:checked={settings.epass.antiScreenshot} />
                                <span class="toggle-switch"></span>
                            </label>
                            <p class="form-hint">Displays user info watermark that appears in screenshots</p>
                        </div>
                        
                        <div class="form-group toggle-group">
                            <label class="toggle-label">
                                <span>Dynamic Watermark</span>
                                <input type="checkbox" bind:checked={settings.epass.watermarkEnabled} />
                                <span class="toggle-switch"></span>
                            </label>
                            <p class="form-hint">Shows timestamp and device info on the ID</p>
                        </div>
                    </div>

                    <div class="preview-section">
                        <h3>E-Pass Preview</h3>
                        <div class="epass-preview" class:hologram={settings.epass.animatedHologram}>
                            <div class="preview-card">
                                <div class="preview-header">
                                    <div class="preview-logo">🎓</div>
                                    <span>Student ID</span>
                                </div>
                                <div class="preview-qr">
                                    <IconQrcode size={80} stroke={1} />
                                    {#if settings.epass.animatedHologram}
                                        <div class="hologram-overlay"></div>
                                    {/if}
                                </div>
                                <div class="preview-info">
                                    <span class="preview-name">John Doe</span>
                                    <span class="preview-id">STU-2024-001</span>
                                </div>
                                {#if settings.epass.watermarkEnabled}
                                    <div class="preview-watermark">Valid • {new Date().toLocaleTimeString()}</div>
                                {/if}
                            </div>
                        </div>
                    </div>

                <!-- 5.3 Department / Course Settings -->
                {:else if activeTab === 'departments'}
                    <h2><IconBuilding size={22} /> Department Settings</h2>
                    <p class="section-desc">Manage departments and courses available in the system</p>
                    
                    <div class="form-section">
                        <h3>Departments</h3>
                        <div class="add-item-row">
                            <input type="text" class="apple-input" placeholder="Enter department name..." bind:value={newDepartment} on:keydown={(e) => e.key === 'Enter' && addDepartment()} />
                            <button class="apple-btn-primary" on:click={addDepartment}><IconPlus size={18} /> Add</button>
                        </div>
                        <div class="items-list">
                            {#if departments.length === 0}
                                <p class="empty-text">No departments added yet</p>
                            {:else}
                                {#each departments as dept, i}
                                    <div class="list-item">
                                        <span class="item-number">{i + 1}</span>
                                        <span class="item-name">{dept}</span>
                                        <button class="remove-btn" on:click={() => removeDepartment(dept)}><IconTrash size={16} /></button>
                                    </div>
                                {/each}
                            {/if}
                        </div>
                    </div>

                <!-- 5.3 Academic / Course Levels -->
                {:else if activeTab === 'academic'}
                    <h2><IconSchool size={22} /> Academic Configuration</h2>
                    
                    <div class="form-section">
                        <h3>Year / Grade Levels</h3>
                        <div class="add-item-row">
                            <input type="text" class="apple-input" placeholder="e.g., 1st Year, Grade 7" bind:value={newYear} on:keydown={(e) => e.key === 'Enter' && addYear()} />
                            <button class="apple-btn-secondary" on:click={addYear}><IconPlus size={18} /> Add</button>
                        </div>
                        <div class="items-grid">
                            {#each years as year}
                                <div class="grid-item">
                                    <span>{year}</span>
                                    <button class="remove-btn-sm" on:click={() => removeYear(year)}>×</button>
                                </div>
                            {/each}
                        </div>
                    </div>

                    <div class="form-section">
                        <h3>Sections</h3>
                        <div class="add-item-row">
                            <input type="text" class="apple-input" placeholder="e.g., A, B, C or Section 1" bind:value={newSection} on:keydown={(e) => e.key === 'Enter' && addSection()} />
                            <button class="apple-btn-secondary" on:click={addSection}><IconPlus size={18} /> Add</button>
                        </div>
                        <div class="items-grid">
                            {#each sections as section}
                                <div class="grid-item">
                                    <span>Section {section}</span>
                                    <button class="remove-btn-sm" on:click={() => removeSection(section)}>×</button>
                                </div>
                            {/each}
                        </div>
                    </div>

                <!-- 5.4 UI Theme Management -->
                {:else if activeTab === 'theme'}
                    <h2><IconPalette size={22} /> UI Theme Management</h2>
                    
                    <!-- Theme Mode Section -->
                    <div class="form-section">
                        <h3><IconPalette size={18} /> Theme Mode</h3>
                        <div class="theme-mode-grid">
                            {#each themeModes as mode}
                                <button 
                                    class="theme-mode-card" 
                                    class:active={settings.theme.themeMode === mode.id}
                                    on:click={() => settings.theme.themeMode = mode.id}
                                >
                                    <div class="theme-mode-icon" style="background: {mode.bg};">
                                        <svelte:component this={mode.icon} size={20} stroke={1.5} color={mode.iconColor} />
                                    </div>
                                    <span class="theme-mode-name">{mode.name}</span>
                                    <span class="theme-mode-desc">{mode.desc}</span>
                                    {#if settings.theme.themeMode === mode.id}
                                        <div class="theme-mode-check">
                                            <IconCheck size={12} stroke={3} />
                                        </div>
                                    {/if}
                                </button>
                            {/each}
                        </div>
                    </div>
                    
                    <div class="form-section">
                        <h3>Color Accent</h3>
                        <div class="color-picker">
                            {#each accentColors as color}
                                <button class="color-btn" class:active={settings.theme.accentColor === color.id} style="background: {color.id}" on:click={() => settings.theme.accentColor = color.id} title={color.label}>
                                    {#if settings.theme.accentColor === color.id}<IconCheck size={16} stroke={3} />{/if}
                                </button>
                            {/each}
                        </div>
                        <div class="form-group" style="margin-top: 16px;">
                            <label class="apple-label">Custom Color</label>
                            <input type="color" class="color-input" bind:value={settings.theme.accentColor} />
                        </div>
                    </div>

                    <div class="form-section">
                        <h3><IconPhoto size={18} /> App Logo / Branding</h3>
                        <div class="upload-area">
                            {#if logoPreview}
                                <div class="logo-preview">
                                    <img src={logoPreview} alt="Logo preview" />
                                    <button class="remove-preview" on:click={() => { logoPreview = null; settings.theme.logoUrl = ''; }}>×</button>
                                </div>
                            {:else}
                                <label class="upload-btn">
                                    <IconPhoto size={24} /> Upload Logo
                                    <input type="file" accept="image/*" on:change={handleLogoUpload} hidden />
                                </label>
                            {/if}
                        </div>
                        <p class="form-hint">Recommended: 200x200px PNG with transparent background</p>
                    </div>

                    <div class="form-section">
                        <h3>Seasonal Themes</h3>
                        <div class="theme-selector">
                            {#each seasonalThemes as theme}
                                <button class="theme-btn" class:active={settings.theme.seasonalTheme === theme.id} on:click={() => settings.theme.seasonalTheme = theme.id}>
                                    <svelte:component this={theme.icon} size={24} stroke={1.5} />
                                    <span>{theme.label}</span>
                                    {#if theme.color}
                                        <span class="theme-color" style="background: {theme.color}"></span>
                                    {/if}
                                </button>
                            {/each}
                        </div>
                    </div>

                    <div class="form-section">
                        <h3>Welcome Banner</h3>
                        <div class="form-group toggle-group">
                            <label class="toggle-label">
                                <span>Show Welcome Banner</span>
                                <input type="checkbox" bind:checked={settings.theme.welcomeBanner.enabled} />
                                <span class="toggle-switch"></span>
                            </label>
                        </div>
                        
                        {#if settings.theme.welcomeBanner.enabled}
                            <div class="form-group">
                                <label class="apple-label">Banner Title</label>
                                <input type="text" class="apple-input" bind:value={settings.theme.welcomeBanner.title} placeholder="Welcome back!" />
                            </div>
                            <div class="form-group">
                                <label class="apple-label">Banner Message</label>
                                <textarea class="apple-input" rows="2" bind:value={settings.theme.welcomeBanner.message} placeholder="Have a great day!"></textarea>
                            </div>
                            <div class="form-group">
                                <label class="apple-label">Banner Image (Optional)</label>
                                <div class="upload-area small">
                                    {#if bannerPreview}
                                        <div class="banner-preview">
                                            <img src={bannerPreview} alt="Banner preview" />
                                            <button class="remove-preview" on:click={() => { bannerPreview = null; settings.theme.welcomeBanner.imageUrl = ''; }}>×</button>
                                        </div>
                                    {:else}
                                        <label class="upload-btn small">
                                            <IconPhoto size={18} /> Upload Image
                                            <input type="file" accept="image/*" on:change={handleBannerUpload} hidden />
                                        </label>
                                    {/if}
                                </div>
                            </div>
                            
                            <div class="banner-preview-card">
                                <h4>Preview</h4>
                                <div class="welcome-banner-preview" style="--accent: {settings.theme.accentColor}">
                                    {#if bannerPreview}
                                        <img src={bannerPreview} alt="Banner" class="banner-bg" />
                                    {/if}
                                    <div class="banner-content">
                                        <h3>{settings.theme.welcomeBanner.title || 'Welcome!'}</h3>
                                        <p>{settings.theme.welcomeBanner.message || 'Have a great day!'}</p>
                                    </div>
                                </div>
                            </div>
                        {/if}
                    </div>

                <!-- Security Settings -->
                {:else if activeTab === 'security'}
                    <h2><IconShield size={22} /> Security Settings</h2>
                    
                    <div class="form-section">
                        <h3>Session Management</h3>
                        <div class="form-group">
                            <label class="apple-label">Session Timeout (hours)</label>
                            <input type="number" class="apple-input" bind:value={settings.security.sessionTimeout} min="1" max="24" />
                            <p class="form-hint">Admin sessions expire after this duration</p>
                        </div>
                    </div>

                    <div class="form-section">
                        <h3>Login Security</h3>
                        <div class="form-group">
                            <label class="apple-label">Max Login Attempts</label>
                            <input type="number" class="apple-input" bind:value={settings.security.maxLoginAttempts} min="3" max="10" />
                            <p class="form-hint">Account locks after this many failed attempts</p>
                        </div>
                        <div class="form-group toggle-group">
                            <label class="toggle-label">
                                <span>Require MFA for Admins</span>
                                <input type="checkbox" bind:checked={settings.security.mfaRequired} />
                                <span class="toggle-switch"></span>
                            </label>
                            <p class="form-hint">Enforce multi-factor authentication for all admin accounts</p>
                        </div>
                    </div>

                    <div class="form-section">
                        <h3>Geofence</h3>
                        <div class="form-group toggle-group">
                            <label class="toggle-label">
                                <span>Enable Geofence Validation</span>
                                <input type="checkbox" bind:checked={settings.attendance.geofenceEnabled} />
                                <span class="toggle-switch"></span>
                            </label>
                            <p class="form-hint">Require users to be within campus location for attendance</p>
                        </div>
                    </div>
                {/if}
            </div>
        </div>
    {/if}
</div>

<style>
    .settings-page { padding: 24px; max-width: 1100px; margin: 0 auto; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; flex-wrap: wrap; gap: 16px; }
    .page-header h1 { font-size: 28px; font-weight: 700; color: var(--theme-text); display: flex; align-items: center; gap: 10px; }
    .header-subtitle { font-size: 15px; color: var(--theme-text-secondary); margin-top: 4px; }
    
    .loading-state { text-align: center; padding: 60px 20px; color: var(--theme-text-secondary); }
    .loading-state p { margin-top: 12px; }
    
    .settings-layout { display: grid; grid-template-columns: 200px 1fr; gap: 24px; }
    .settings-tabs { display: flex; flex-direction: column; gap: 4px; }
    .tab-btn { display: flex; align-items: center; gap: 10px; padding: 12px 16px; background: none; border: none; border-radius: var(--apple-radius-md); font-size: 14px; font-weight: 500; color: var(--theme-text-secondary); cursor: pointer; text-align: left; transition: var(--apple-transition); }
    .tab-btn:hover { background: var(--theme-border-light); }
    .tab-btn.active { background: rgba(0, 122, 255, 0.1); color: var(--apple-accent); }
    
    .settings-content { padding: 24px; }
    .settings-content h2 { font-size: 20px; font-weight: 600; margin-bottom: 8px; color: var(--theme-text); display: flex; align-items: center; gap: 8px; }
    .section-desc { font-size: 14px; color: var(--theme-text-secondary); margin-bottom: 24px; }
    
    .form-section { margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid var(--theme-border-light); }
    .form-section:last-child { border-bottom: none; margin-bottom: 0; }
    .form-section h3 { font-size: 16px; font-weight: 600; margin-bottom: 16px; color: var(--theme-text); display: flex; align-items: center; gap: 8px; }
    .form-section h4 { font-size: 14px; font-weight: 600; margin: 16px 0 12px; color: var(--theme-text-secondary); }
    
    .form-group { margin-bottom: 16px; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .form-hint { font-size: 12px; color: var(--theme-text-secondary); margin-top: 6px; }
    
    .toggle-group { padding: 16px; background: var(--theme-border-light); border-radius: var(--apple-radius-md); margin-bottom: 12px; }
    .toggle-label { display: flex; align-items: center; justify-content: space-between; cursor: pointer; }
    .toggle-label span:first-child { font-size: 14px; font-weight: 500; color: var(--theme-text); }
    .toggle-label input { display: none; }
    .toggle-switch { width: 44px; height: 24px; background: var(--apple-gray-3); border-radius: 12px; position: relative; transition: var(--apple-transition); flex-shrink: 0; }
    .toggle-switch::after { content: ''; position: absolute; width: 20px; height: 20px; background: white; border-radius: 50%; top: 2px; left: 2px; transition: var(--apple-transition); box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
    .toggle-label input:checked + .toggle-switch { background: var(--apple-green); }
    .toggle-label input:checked + .toggle-switch::after { left: 22px; }
    
    .weekday-selector { display: flex; gap: 8px; flex-wrap: wrap; }
    .weekday-btn { padding: 10px 16px; border: 1px solid var(--theme-border); background: var(--theme-card-bg); border-radius: var(--apple-radius-md); font-size: 13px; font-weight: 500; color: var(--theme-text-secondary); cursor: pointer; transition: var(--apple-transition); }
    .weekday-btn:hover { border-color: var(--apple-accent); }
    .weekday-btn.active { background: var(--apple-accent); border-color: var(--apple-accent); color: white; }
    
    .add-item-row { display: flex; gap: 12px; margin-bottom: 16px; }
    .add-item-row .apple-input { flex: 1; }
    .date-input { max-width: 160px; }
    
    .items-list { display: flex; flex-direction: column; gap: 8px; }
    .list-item { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: var(--theme-border-light); border-radius: var(--apple-radius-md); }
    .item-number { width: 24px; height: 24px; background: var(--apple-accent); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; }
    .item-name, .holiday-name { flex: 1; font-size: 14px; color: var(--theme-text); }
    .holiday-date { font-size: 12px; color: var(--theme-text-secondary); }
    .remove-btn { background: none; border: none; color: var(--apple-red); cursor: pointer; padding: 4px; border-radius: 4px; opacity: 0.7; }
    .remove-btn:hover { background: rgba(255, 59, 48, 0.1); opacity: 1; }
    
    .items-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
    .grid-item { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: var(--theme-border-light); border-radius: var(--apple-radius-md); font-size: 13px; }
    .remove-btn-sm { background: none; border: none; color: var(--theme-text-secondary); cursor: pointer; font-size: 16px; line-height: 1; padding: 0 4px; }
    .remove-btn-sm:hover { color: var(--apple-red); }
    
    .empty-text { font-size: 14px; color: var(--theme-text-secondary); text-align: center; padding: 24px; }

    /* E-Pass Preview */
    .action-card { display: flex; align-items: center; justify-content: space-between; padding: 16px; background: var(--theme-border-light); border-radius: var(--apple-radius-md); margin-top: 16px; }
    .action-info h4 { font-size: 14px; font-weight: 600; color: var(--theme-text); margin-bottom: 4px; }
    .action-info p { font-size: 12px; color: var(--theme-text-secondary); }
    .apple-btn-danger { background: var(--apple-red); color: white; border: none; padding: 10px 16px; border-radius: var(--apple-radius-md); font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; }
    .apple-btn-danger:hover { background: #d62d22; }
    .apple-btn-danger:disabled { opacity: 0.6; cursor: not-allowed; }
    
    .preview-section { margin-top: 24px; }
    .preview-section h3 { font-size: 14px; font-weight: 600; color: var(--theme-text-secondary); margin-bottom: 16px; }
    .epass-preview { display: flex; justify-content: center; padding: 24px; background: var(--theme-border-light); border-radius: var(--apple-radius-lg); }
    .preview-card { width: 200px; background: white; border-radius: 16px; padding: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); text-align: center; position: relative; overflow: hidden; }
    .preview-header { display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 12px; }
    .preview-logo { font-size: 24px; }
    .preview-header span { font-size: 12px; font-weight: 600; color: var(--apple-gray-1); }
    .preview-qr { position: relative; padding: 16px; background: #f5f5f5; border-radius: 12px; margin-bottom: 12px; }
    .preview-info { display: flex; flex-direction: column; gap: 2px; }
    .preview-name { font-size: 14px; font-weight: 600; color: #1c1c1e; }
    .preview-id { font-size: 11px; color: #8e8e93; }
    .preview-watermark { font-size: 9px; color: #8e8e93; margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e5ea; }
    
    .hologram-overlay { position: absolute; inset: 0; background: linear-gradient(135deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0) 100%); animation: hologram 2s ease-in-out infinite; pointer-events: none; }
    @keyframes hologram { 0%, 100% { transform: translateX(-100%); } 50% { transform: translateX(100%); } }
    
    /* Theme Settings */
    .color-picker { display: flex; gap: 12px; flex-wrap: wrap; }
    .color-btn { width: 40px; height: 40px; border-radius: 50%; border: 3px solid transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; color: white; transition: var(--apple-transition); }
    .color-btn:hover { transform: scale(1.1); }
    .color-btn.active { border-color: var(--theme-text); box-shadow: 0 0 0 2px var(--theme-card-bg); }
    .color-input { width: 60px; height: 40px; border: none; border-radius: var(--apple-radius-sm); cursor: pointer; }
    
    /* Theme Mode Grid - Apple-style design */
    .theme-mode-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 16px;
    }
    
    .theme-mode-card {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        padding: 20px 12px 16px;
        background: var(--theme-card-bg);
        border: 2px solid var(--theme-border-light);
        border-radius: 16px;
        cursor: pointer;
        transition: all 0.2s ease;
    }
    
    .theme-mode-card:hover {
        border-color: var(--theme-border);
        transform: translateY(-2px);
    }
    
    .theme-mode-card.active {
        border-color: var(--apple-green);
        background: rgba(52, 199, 89, 0.05);
        box-shadow: 0 0 0 1px var(--apple-green);
    }
    
    .theme-mode-icon {
        width: 52px;
        height: 52px;
        border-radius: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.2s ease;
    }
    
    .theme-mode-card:hover .theme-mode-icon {
        transform: scale(1.05);
    }
    
    .theme-mode-name {
        font-size: 14px;
        font-weight: 600;
        color: var(--theme-text);
        margin-top: 4px;
    }
    
    .theme-mode-desc {
        font-size: 12px;
        color: var(--theme-text-secondary);
    }
    
    .theme-mode-check {
        position: absolute;
        top: 10px;
        right: 10px;
        width: 22px;
        height: 22px;
        background: var(--apple-green);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        box-shadow: 0 2px 8px rgba(52, 199, 89, 0.4);
    }
    
    @media (max-width: 900px) {
        .theme-mode-grid {
            grid-template-columns: repeat(4, 1fr);
        }
    }
    
    @media (max-width: 700px) {
        .theme-mode-grid {
            grid-template-columns: repeat(2, 1fr);
        }
    }
    
    @media (max-width: 400px) {
        .theme-mode-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
        }
        
        .theme-mode-card {
            padding: 14px 8px 12px;
        }
        
        .theme-mode-icon {
            width: 44px;
            height: 44px;
            border-radius: 12px;
        }
        
        .theme-mode-name {
            font-size: 13px;
        }
        
        .theme-mode-desc {
            font-size: 11px;
        }
    }
    
    .upload-area { border: 2px dashed var(--theme-border); border-radius: var(--apple-radius-md); padding: 24px; text-align: center; }
    .upload-area.small { padding: 16px; }
    .upload-btn { display: inline-flex; align-items: center; gap: 8px; padding: 12px 20px; background: var(--theme-border-light); border-radius: var(--apple-radius-md); cursor: pointer; font-size: 14px; color: var(--theme-text-secondary); transition: var(--apple-transition); }
    .upload-btn:hover { background: var(--theme-border); }
    .upload-btn.small { padding: 8px 14px; font-size: 13px; }
    .logo-preview, .banner-preview { position: relative; display: inline-block; }
    .logo-preview img { max-width: 120px; max-height: 120px; border-radius: var(--apple-radius-md); }
    .banner-preview img { max-width: 100%; max-height: 100px; border-radius: var(--apple-radius-sm); }
    .remove-preview { position: absolute; top: -8px; right: -8px; width: 24px; height: 24px; background: var(--apple-red); color: white; border: none; border-radius: 50%; cursor: pointer; font-size: 16px; line-height: 1; }
    
    .theme-selector { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; }
    .theme-btn { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 16px; background: var(--theme-card-bg); border: 2px solid var(--theme-border); border-radius: var(--apple-radius-md); cursor: pointer; transition: var(--apple-transition); }
    .theme-btn:hover { border-color: var(--apple-accent); }
    .theme-btn.active { border-color: var(--apple-accent); background: rgba(0, 122, 255, 0.05); }
    .theme-btn span { font-size: 13px; font-weight: 500; }
    .theme-color { width: 16px; height: 16px; border-radius: 50%; }
    
    .banner-preview-card { margin-top: 20px; }
    .banner-preview-card h4 { font-size: 12px; font-weight: 600; color: var(--theme-text-secondary); margin-bottom: 12px; }
    .welcome-banner-preview { position: relative; padding: 20px; background: linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 70%, black)); border-radius: var(--apple-radius-lg); color: white; overflow: hidden; }
    .welcome-banner-preview .banner-bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0.3; }
    .welcome-banner-preview .banner-content { position: relative; z-index: 1; }
    .welcome-banner-preview h3 { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
    .welcome-banner-preview p { font-size: 14px; opacity: 0.9; }
    
    :global(.spin) { animation: spin 1s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    
    @media (max-width: 768px) {
        .settings-layout { grid-template-columns: 1fr; }
        .settings-tabs { flex-direction: row; overflow-x: auto; gap: 8px; padding-bottom: 8px; }
        .tab-btn { white-space: nowrap; flex-shrink: 0; }
        .form-row { grid-template-columns: 1fr; }
        .action-card { flex-direction: column; gap: 12px; text-align: center; }
    }
</style>
