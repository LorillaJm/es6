// src/lib/security/passwordPolicy.js
// Enterprise Password Policy - Strong password validation

/**
 * Password policy configuration
 */
export const PASSWORD_POLICY = {
    minLength: 8,
    maxLength: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    specialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?',
    preventCommonPasswords: true,
    preventUserInfo: true, // Prevent using email/name in password
    maxRepeatingChars: 3
};

/**
 * Common weak passwords to block
 */
const COMMON_PASSWORDS = [
    'password', 'password123', '123456', '12345678', 'qwerty', 'abc123',
    'monkey', 'master', 'dragon', 'letmein', 'login', 'admin', 'welcome',
    'password1', 'sunshine', 'princess', 'football', 'iloveyou', 'trustno1',
    'passw0rd', 'shadow', 'ashley', 'michael', 'ninja', 'mustang', 'access',
    'batman', 'superman', 'starwars', 'hello', 'charlie', 'donald', 'qwerty123'
];

/**
 * Validate password against policy
 * @param {string} password - Password to validate
 * @param {object} userInfo - Optional user info to check against
 * @returns {object} Validation result with errors
 */
export function validatePassword(password, userInfo = {}) {
    const errors = [];
    const suggestions = [];
    let strength = 0;

    if (!password) {
        return { valid: false, errors: ['Password is required'], strength: 0 };
    }

    // Length check
    if (password.length < PASSWORD_POLICY.minLength) {
        errors.push(`Password must be at least ${PASSWORD_POLICY.minLength} characters`);
    } else {
        strength += 20;
    }

    if (password.length > PASSWORD_POLICY.maxLength) {
        errors.push(`Password must be less than ${PASSWORD_POLICY.maxLength} characters`);
    }

    // Uppercase check
    if (PASSWORD_POLICY.requireUppercase && !/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
        suggestions.push('Add an uppercase letter (A-Z)');
    } else if (/[A-Z]/.test(password)) {
        strength += 15;
    }

    // Lowercase check
    if (PASSWORD_POLICY.requireLowercase && !/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
        suggestions.push('Add a lowercase letter (a-z)');
    } else if (/[a-z]/.test(password)) {
        strength += 15;
    }

    // Number check
    if (PASSWORD_POLICY.requireNumbers && !/[0-9]/.test(password)) {
        errors.push('Password must contain at least one number');
        suggestions.push('Add a number (0-9)');
    } else if (/[0-9]/.test(password)) {
        strength += 15;
    }

    // Special character check
    const specialRegex = new RegExp(`[${escapeRegex(PASSWORD_POLICY.specialChars)}]`);
    if (PASSWORD_POLICY.requireSpecialChars && !specialRegex.test(password)) {
        errors.push('Password must contain at least one special character');
        suggestions.push(`Add a special character (${PASSWORD_POLICY.specialChars})`);
    } else if (specialRegex.test(password)) {
        strength += 20;
    }

    // Common password check
    if (PASSWORD_POLICY.preventCommonPasswords) {
        const lowerPassword = password.toLowerCase();
        if (COMMON_PASSWORDS.some(common => lowerPassword.includes(common))) {
            errors.push('Password is too common. Please choose a stronger password');
        }
    }

    // User info check (prevent using email/name in password)
    if (PASSWORD_POLICY.preventUserInfo && userInfo) {
        const lowerPassword = password.toLowerCase();
        const { email, name, username } = userInfo;
        
        if (email && lowerPassword.includes(email.split('@')[0].toLowerCase())) {
            errors.push('Password cannot contain your email');
        }
        if (name && lowerPassword.includes(name.toLowerCase())) {
            errors.push('Password cannot contain your name');
        }
        if (username && lowerPassword.includes(username.toLowerCase())) {
            errors.push('Password cannot contain your username');
        }
    }

    // Repeating characters check
    const repeatingRegex = new RegExp(`(.)\\1{${PASSWORD_POLICY.maxRepeatingChars},}`);
    if (repeatingRegex.test(password)) {
        errors.push(`Password cannot have more than ${PASSWORD_POLICY.maxRepeatingChars} repeating characters`);
    }

    // Sequential characters check
    if (hasSequentialChars(password, 4)) {
        errors.push('Password cannot contain sequential characters (e.g., 1234, abcd)');
        strength -= 10;
    }

    // Bonus for length
    if (password.length >= 12) strength += 10;
    if (password.length >= 16) strength += 5;

    // Cap strength at 100
    strength = Math.max(0, Math.min(100, strength));

    return {
        valid: errors.length === 0,
        errors,
        suggestions,
        strength,
        strengthLabel: getStrengthLabel(strength)
    };
}

/**
 * Check for sequential characters
 */
function hasSequentialChars(password, minLength) {
    const sequences = [
        'abcdefghijklmnopqrstuvwxyz',
        'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        '0123456789',
        'qwertyuiop',
        'asdfghjkl',
        'zxcvbnm'
    ];

    const lowerPassword = password.toLowerCase();
    
    for (const seq of sequences) {
        for (let i = 0; i <= seq.length - minLength; i++) {
            const chunk = seq.substring(i, i + minLength);
            if (lowerPassword.includes(chunk) || lowerPassword.includes(chunk.split('').reverse().join(''))) {
                return true;
            }
        }
    }
    return false;
}

/**
 * Get strength label from score
 */
function getStrengthLabel(strength) {
    if (strength >= 80) return 'Strong';
    if (strength >= 60) return 'Good';
    if (strength >= 40) return 'Fair';
    if (strength >= 20) return 'Weak';
    return 'Very Weak';
}

/**
 * Escape special regex characters
 */
function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Generate a secure random password
 * @param {number} length - Password length (default 16)
 * @returns {string} Generated password
 */
export function generateSecurePassword(length = 16) {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = '!@#$%^&*()_+-=';
    
    const allChars = uppercase + lowercase + numbers + special;
    
    // Ensure at least one of each required type
    let password = '';
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += special[Math.floor(Math.random() * special.length)];
    
    // Fill the rest randomly
    for (let i = password.length; i < length; i++) {
        password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
}

export default {
    validatePassword,
    generateSecurePassword,
    PASSWORD_POLICY
};
