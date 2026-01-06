<!-- src/routes/security/+page.svelte -->
<!-- Security & Data Protection Page -->
<script>
    import { IconArrowLeft, IconShieldLock, IconLock, IconEye, IconServer, IconUsers } from '@tabler/icons-svelte';
    
    const organizationName = 'Student Attendance System';
    const securityEmail = 'security@example.com';
    
    const securityFeatures = [
        {
            icon: IconLock,
            title: 'Authentication & Access Control',
            items: [
                'Multi-factor authentication (MFA) support',
                'Role-based access control (RBAC)',
                'Automatic session timeout',
                'Account lockout after failed login attempts',
                'IP-based access restrictions (configurable)'
            ]
        },
        {
            icon: IconShieldLock,
            title: 'Data Protection',
            items: [
                'All data encrypted in transit using TLS/HTTPS',
                'Passwords hashed using PBKDF2 with SHA-512',
                'Database encryption at rest',
                'Regular security audits and updates'
            ]
        },
        {
            icon: IconEye,
            title: 'Monitoring & Logging',
            items: [
                'Comprehensive audit logging of all administrative actions',
                'Real-time monitoring for suspicious activity',
                'Automated alerts for security events',
                'Log retention for compliance and investigation'
            ]
        },
        {
            icon: IconServer,
            title: 'Infrastructure Security',
            items: [
                'Hosted on enterprise-grade cloud infrastructure',
                'Regular security patches and updates',
                'DDoS protection',
                'Automated backups'
            ]
        }
    ];
</script>

<svelte:head>
    <title>Security & Data Protection | {organizationName}</title>
    <meta name="description" content="Learn about our security measures and how we protect your data at {organizationName}." />
</svelte:head>

<div class="legal-page">
    <header class="legal-header">
        <a href="/" class="back-link">
            <IconArrowLeft size={20} />
            <span>Back to Home</span>
        </a>
        <div class="header-content">
            <div class="icon-wrapper">
                <IconShieldLock size={32} />
            </div>
            <h1>Security & Data Protection</h1>
            <p class="subtitle">Our commitment to keeping your data safe</p>
        </div>
    </header>
    
    <main class="legal-content">
        <section class="intro-section">
            <p>
                We take the security of your data seriously. This page describes the 
                technical and organizational measures we implement to protect your 
                information.
            </p>
        </section>
        
        <h2 class="section-title">Technical Security Measures</h2>
        
        <div class="features-grid">
            {#each securityFeatures as feature}
                <div class="feature-card">
                    <div class="feature-icon">
                        <svelte:component this={feature.icon} size={24} />
                    </div>
                    <h3>{feature.title}</h3>
                    <ul>
                        {#each feature.items as item}
                            <li>{item}</li>
                        {/each}
                    </ul>
                </div>
            {/each}
        </div>
        
        <section>
            <h2>Organizational Measures</h2>
            <ul>
                <li>Security awareness training for administrators</li>
                <li>Incident response procedures</li>
                <li>Regular access reviews</li>
                <li>Vendor security assessments</li>
            </ul>
        </section>
        
        <section class="report-section">
            <div class="report-icon">
                <IconUsers size={32} />
            </div>
            <h2>Reporting Security Issues</h2>
            <p>
                If you discover a security vulnerability, please report it responsibly. 
                We appreciate responsible disclosure and will acknowledge your contribution.
            </p>
            <a href="mailto:{securityEmail}" class="report-button">
                Report a Security Issue
            </a>
        </section>
        
        <section>
            <h2>Data Protection Principles</h2>
            <p>This system is designed with data protection principles in mind:</p>
            <ul>
                <li><strong>Data minimization</strong> - We collect only necessary information</li>
                <li><strong>Purpose limitation</strong> - Data used only for stated purposes</li>
                <li><strong>Storage limitation</strong> - Data retained only as long as needed</li>
                <li><strong>Integrity and confidentiality</strong> - Appropriate security measures applied</li>
            </ul>
        </section>
        
        <section class="disclaimer-section">
            <h2>Compliance Note</h2>
            <p>
                This system is designed with security best practices in mind. Organizations 
                with specific compliance requirements (e.g., HIPAA, SOC 2, GDPR) should 
                conduct their own assessment to ensure the system meets their specific needs.
            </p>
        </section>
    </main>
    
    <footer class="legal-footer">
        <p>© {new Date().getFullYear()} {organizationName}. All rights reserved.</p>
        <nav>
            <a href="/privacy">Privacy Policy</a>
            <a href="/terms">Terms of Service</a>
        </nav>
    </footer>
</div>

<style>
    .legal-page {
        min-height: 100vh;
        background: var(--theme-bg, #f5f5f7);
        color: var(--theme-text, #1a1a1a);
    }
    
    .legal-header {
        background: var(--theme-card-bg, #fff);
        border-bottom: 1px solid var(--theme-border, #e5e5e5);
        padding: 20px;
    }
    
    .back-link {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        color: var(--apple-accent, #007AFF);
        text-decoration: none;
        font-weight: 500;
        margin-bottom: 24px;
    }
    
    .back-link:hover {
        text-decoration: underline;
    }
    
    .header-content {
        max-width: 800px;
        margin: 0 auto;
        text-align: center;
    }
    
    .icon-wrapper {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 64px;
        height: 64px;
        border-radius: 16px;
        background: linear-gradient(135deg, #FF9500 0%, #FF3B30 100%);
        color: white;
        margin-bottom: 16px;
    }
    
    .legal-header h1 {
        margin: 0 0 8px 0;
        font-size: 2rem;
        font-weight: 700;
    }
    
    .subtitle {
        color: var(--theme-text-secondary, #666);
        font-size: 1.1rem;
        margin: 0;
    }
    
    .legal-content {
        max-width: 900px;
        margin: 0 auto;
        padding: 40px 20px;
    }
    
    .intro-section {
        text-align: center;
        margin-bottom: 40px;
    }
    
    .intro-section p {
        font-size: 1.1rem;
        max-width: 600px;
        margin: 0 auto;
    }
    
    .section-title {
        font-size: 1.5rem;
        font-weight: 700;
        margin: 0 0 24px 0;
        text-align: center;
    }
    
    .features-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 20px;
        margin-bottom: 40px;
    }
    
    .feature-card {
        background: var(--theme-card-bg, #fff);
        border-radius: 16px;
        padding: 24px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    }
    
    .feature-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 48px;
        height: 48px;
        border-radius: 12px;
        background: var(--apple-accent, #007AFF);
        color: white;
        margin-bottom: 16px;
    }
    
    .feature-card h3 {
        font-size: 1.1rem;
        font-weight: 600;
        margin: 0 0 12px 0;
    }
    
    .feature-card ul {
        margin: 0;
        padding-left: 20px;
    }
    
    .feature-card li {
        font-size: 0.9rem;
        color: var(--theme-text-secondary, #555);
        margin: 6px 0;
        line-height: 1.5;
    }
    
    section {
        background: var(--theme-card-bg, #fff);
        border-radius: 12px;
        padding: 24px;
        margin-bottom: 20px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
    
    h2 {
        font-size: 1.25rem;
        font-weight: 600;
        margin: 0 0 16px 0;
        color: var(--theme-text, #1a1a1a);
    }
    
    p {
        line-height: 1.7;
        color: var(--theme-text-secondary, #555);
        margin: 0 0 12px 0;
    }
    
    ul {
        margin: 0;
        padding-left: 24px;
    }
    
    li {
        line-height: 1.7;
        color: var(--theme-text-secondary, #555);
        margin: 8px 0;
    }
    
    .report-section {
        text-align: center;
        background: linear-gradient(135deg, #007AFF10 0%, #5856D610 100%);
        border: 1px solid var(--apple-accent, #007AFF);
    }
    
    .report-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 64px;
        height: 64px;
        border-radius: 50%;
        background: var(--apple-accent, #007AFF);
        color: white;
        margin-bottom: 16px;
    }
    
    .report-button {
        display: inline-block;
        padding: 12px 24px;
        background: var(--apple-accent, #007AFF);
        color: white;
        text-decoration: none;
        border-radius: 8px;
        font-weight: 600;
        margin-top: 8px;
        transition: transform 0.2s, box-shadow 0.2s;
    }
    
    .report-button:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 122, 255, 0.3);
    }
    
    .disclaimer-section {
        background: #FFF3CD;
        border: 1px solid #FFE69C;
    }
    
    .disclaimer-section h2 {
        color: #856404;
    }
    
    .disclaimer-section p {
        color: #856404;
    }
    
    .legal-footer {
        text-align: center;
        padding: 40px 20px;
        border-top: 1px solid var(--theme-border, #e5e5e5);
        background: var(--theme-card-bg, #fff);
    }
    
    .legal-footer p {
        margin-bottom: 16px;
    }
    
    .legal-footer nav {
        display: flex;
        justify-content: center;
        gap: 24px;
    }
    
    .legal-footer nav a {
        color: var(--apple-accent, #007AFF);
        text-decoration: none;
        font-weight: 500;
    }
    
    .legal-footer nav a:hover {
        text-decoration: underline;
    }
</style>
