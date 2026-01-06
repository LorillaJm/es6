<!-- src/routes/terms/+page.svelte -->
<!-- Terms of Service Page -->
<script>
    import { IconArrowLeft, IconFileText } from '@tabler/icons-svelte';
    
    const lastUpdated = 'January 6, 2026';
    const organizationName = 'Student Attendance System';
    const contactEmail = 'legal@example.com';
</script>

<svelte:head>
    <title>Terms of Service | {organizationName}</title>
    <meta name="description" content="Terms of Service for {organizationName} - Read our terms and conditions for using the service." />
</svelte:head>

<div class="legal-page">
    <header class="legal-header">
        <a href="/" class="back-link">
            <IconArrowLeft size={20} />
            <span>Back to Home</span>
        </a>
        <div class="header-content">
            <div class="icon-wrapper">
                <IconFileText size={32} />
            </div>
            <h1>Terms of Service</h1>
            <p class="last-updated">Last Updated: {lastUpdated}</p>
        </div>
    </header>
    
    <main class="legal-content">
        <section>
            <h2>1. Acceptance of Terms</h2>
            <p>
                By accessing or using the {organizationName} ("Service"), you agree to be 
                bound by these Terms of Service ("Terms"). If you do not agree to these 
                Terms, do not use the Service.
            </p>
        </section>
        
        <section>
            <h2>2. Description of Service</h2>
            <p>
                The Service provides digital attendance tracking, reporting, and management 
                capabilities for educational institutions and organizations.
            </p>
        </section>
        
        <section>
            <h2>3. User Accounts</h2>
            
            <h3>3.1 Account Creation</h3>
            <ul>
                <li>Accounts are created by authorized administrators</li>
                <li>You are responsible for maintaining account security</li>
                <li>You must not share login credentials with others</li>
            </ul>
            
            <h3>3.2 Account Responsibilities</h3>
            <ul>
                <li>Provide accurate and complete information</li>
                <li>Keep your contact information current</li>
                <li>Report unauthorized access immediately</li>
            </ul>
        </section>
        
        <section>
            <h2>4. Acceptable Use</h2>
            <p>You agree NOT to:</p>
            <ul>
                <li>Access accounts or data belonging to others without authorization</li>
                <li>Attempt to bypass or circumvent security measures</li>
                <li>Use the Service for any unlawful purpose</li>
                <li>Interfere with or disrupt the Service's operation</li>
                <li>Submit false or fraudulent attendance records</li>
                <li>Share or distribute confidential data</li>
                <li>Reverse engineer or attempt to extract source code</li>
            </ul>
        </section>
        
        <section>
            <h2>5. Administrator Responsibilities</h2>
            <p>Administrators with elevated access agree to:</p>
            <ul>
                <li>Use administrative privileges only for legitimate purposes</li>
                <li>Protect user data and privacy at all times</li>
                <li>Follow established data handling procedures</li>
                <li>Report security incidents promptly</li>
                <li>Not abuse access to user information</li>
                <li>Maintain confidentiality of system access</li>
            </ul>
        </section>
        
        <section>
            <h2>6. Intellectual Property</h2>
            <p>
                The Service, including its design, features, and content, is protected by 
                intellectual property laws. You may not copy, modify, distribute, or create 
                derivative works from any part of the Service without explicit authorization.
            </p>
        </section>
        
        <section>
            <h2>7. Data and Privacy</h2>
            <p>
                Your use of the Service is also governed by our 
                <a href="/privacy">Privacy Policy</a>. By using the Service, you consent 
                to data collection and use as described therein.
            </p>
        </section>
        
        <section>
            <h2>8. Disclaimer of Warranties</h2>
            <p>
                THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF 
                ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES 
                OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
            </p>
            <p>
                We do not guarantee that the Service will be uninterrupted, error-free, 
                or completely secure.
            </p>
        </section>
        
        <section>
            <h2>9. Limitation of Liability</h2>
            <p>
                TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL WE 
                BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE 
                DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR 
                INDIRECTLY, ARISING FROM YOUR USE OF THE SERVICE.
            </p>
        </section>
        
        <section>
            <h2>10. Indemnification</h2>
            <p>
                You agree to indemnify, defend, and hold harmless {organizationName} and 
                its officers, directors, employees, and agents from any claims, damages, 
                losses, or expenses (including reasonable attorney fees) arising from your 
                violation of these Terms or misuse of the Service.
            </p>
        </section>
        
        <section>
            <h2>11. Termination</h2>
            <p>
                We may suspend or terminate your access to the Service at any time, with 
                or without cause, and with or without notice. Upon termination, your right 
                to use the Service will immediately cease.
            </p>
        </section>
        
        <section>
            <h2>12. Changes to Terms</h2>
            <p>
                We reserve the right to modify these Terms at any time. We will notify 
                users of significant changes through the Service or via email. Your 
                continued use of the Service after changes constitutes acceptance of the 
                modified Terms.
            </p>
        </section>
        
        <section>
            <h2>13. Contact</h2>
            <p>
                For questions about these Terms, please contact us at: 
                <a href="mailto:{contactEmail}">{contactEmail}</a>
            </p>
        </section>
    </main>
    
    <footer class="legal-footer">
        <p>© {new Date().getFullYear()} {organizationName}. All rights reserved.</p>
        <nav>
            <a href="/privacy">Privacy Policy</a>
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
        background: linear-gradient(135deg, #007AFF 0%, #5856D6 100%);
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
