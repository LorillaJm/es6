<!-- src/routes/privacy/+page.svelte -->
<!-- Privacy Policy Page -->
<script>
    import { IconArrowLeft, IconShieldCheck } from '@tabler/icons-svelte';
    
    const lastUpdated = 'January 6, 2026';
    const organizationName = 'Student Attendance System';
    const contactEmail = 'privacy@example.com';
</script>

<svelte:head>
    <title>Privacy Policy | {organizationName}</title>
    <meta name="description" content="Privacy Policy for {organizationName} - Learn how we collect, use, and protect your information." />
</svelte:head>

<div class="legal-page">
    <header class="legal-header">
        <a href="/" class="back-link">
            <IconArrowLeft size={20} />
            <span>Back to Home</span>
        </a>
        <div class="header-content">
            <div class="icon-wrapper">
                <IconShieldCheck size={32} />
            </div>
            <h1>Privacy Policy</h1>
            <p class="last-updated">Last Updated: {lastUpdated}</p>
        </div>
    </header>
    
    <main class="legal-content">
        <section>
            <h2>1. Introduction</h2>
            <p>
                This Privacy Policy describes how {organizationName} ("we," "us," or "our") 
                collects, uses, and protects information when you use our attendance tracking 
                service (the "Service").
            </p>
            <p>
                By using our Service, you agree to the collection and use of information in 
                accordance with this policy.
            </p>
        </section>
        
        <section>
            <h2>2. Information We Collect</h2>
            
            <h3>2.1 Account Information</h3>
            <ul>
                <li>Name and email address</li>
                <li>Student/Employee ID</li>
                <li>Department and section information</li>
                <li>Profile photograph (optional)</li>
            </ul>
            
            <h3>2.2 Attendance Data</h3>
            <ul>
                <li>Check-in and check-out timestamps</li>
                <li>Location data (if geofencing is enabled)</li>
                <li>Device information used for attendance</li>
            </ul>
            
            <h3>2.3 Technical Data</h3>
            <ul>
                <li>IP addresses</li>
                <li>Browser type and version</li>
                <li>Device identifiers</li>
                <li>Usage logs and analytics</li>
            </ul>
        </section>
        
        <section>
            <h2>3. How We Use Your Information</h2>
            <p>We use collected information to:</p>
            <ul>
                <li>Provide and maintain the attendance tracking service</li>
                <li>Verify user identity and prevent fraud</li>
                <li>Generate attendance reports and analytics</li>
                <li>Communicate important updates and announcements</li>
                <li>Improve our services and user experience</li>
                <li>Comply with legal obligations</li>
            </ul>
        </section>
        
        <section>
            <h2>4. Data Storage and Security</h2>
            <ul>
                <li>Data is stored on secure cloud infrastructure</li>
                <li>All data transmission uses HTTPS encryption</li>
                <li>Passwords are hashed using industry-standard algorithms</li>
                <li>Access to data is restricted based on role permissions</li>
                <li>Regular security audits are conducted</li>
            </ul>
        </section>
        
        <section>
            <h2>5. Data Retention</h2>
            <ul>
                <li><strong>Active user data:</strong> Retained while account is active</li>
                <li><strong>Attendance records:</strong> Retained for compliance purposes</li>
                <li><strong>Audit logs:</strong> Retained for 1 year minimum</li>
                <li><strong>Deleted accounts:</strong> Data removed within 30 days of deletion request</li>
            </ul>
        </section>
        
        <section>
            <h2>6. Your Rights</h2>
            <p>You have the right to:</p>
            <ul>
                <li>Access your personal data</li>
                <li>Request correction of inaccurate data</li>
                <li>Request deletion of your data (subject to legal retention requirements)</li>
                <li>Export your data in a portable format</li>
                <li>Withdraw consent for optional data processing</li>
            </ul>
        </section>
        
        <section>
            <h2>7. Data Sharing</h2>
            <p>
                We do not sell your personal data. We may share data with:
            </p>
            <ul>
                <li>Authorized administrators within your organization</li>
                <li>Service providers who assist in operating our platform</li>
                <li>Legal authorities when required by law</li>
            </ul>
        </section>
        
        <section>
            <h2>8. Cookies and Tracking</h2>
            <p>We use essential cookies for:</p>
            <ul>
                <li>Authentication and session management</li>
                <li>Security (CSRF protection)</li>
                <li>User preferences</li>
            </ul>
        </section>
        
        <section>
            <h2>9. Changes to This Policy</h2>
            <p>
                We may update this policy periodically. Significant changes will be 
                communicated through the Service or via email.
            </p>
        </section>
        
        <section>
            <h2>10. Contact</h2>
            <p>
                For privacy-related inquiries, please contact us at: 
                <a href="mailto:{contactEmail}">{contactEmail}</a>
            </p>
        </section>
    </main>
    
    <footer class="legal-footer">
        <p>© {new Date().getFullYear()} {organizationName}. All rights reserved.</p>
        <nav>
            <a href="/terms">Terms of Service</a>
            <a href="/security">Security</a>
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
        background: linear-gradient(135deg, #34C759 0%, #30D158 100%);
        color: white;
        margin-bottom: 16px;
    }
    
    .legal-header h1 {
        margin: 0 0 8px 0;
        font-size: 2rem;
        font-weight: 700;
    }
    
    .last-updated {
        color: var(--theme-text-secondary, #666);
        font-size: 0.875rem;
    }
    
    .legal-content {
        max-width: 800px;
        margin: 0 auto;
        padding: 40px 20px;
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
    
    h3 {
        font-size: 1rem;
        font-weight: 600;
        margin: 20px 0 12px 0;
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
    
    a {
        color: var(--apple-accent, #007AFF);
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
        text-decoration: none;
        font-weight: 500;
    }
    
    .legal-footer nav a:hover {
        text-decoration: underline;
    }
</style>
