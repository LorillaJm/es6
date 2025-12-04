// src/routes/app/+layout.js

export const prerender = false;
export async function load({ parent }) {
    await parent();
    return {
    };
}