
import * as chatService from '../apps/backend/src/services/chat.service.ts';
import * as aiService from '../apps/backend/src/services/ai.service.ts';

console.log('--- Chat Service Exports ---');
console.log(Object.keys(chatService));

console.log('\n--- AI Service Exports ---');
console.log(Object.keys(aiService));

try {
    console.log('\nChecking chatService.getQuota...');
    if (typeof chatService.getQuota === 'function') {
        console.log('chatService.getQuota is a function.');
    } else {
        console.error('chatService.getQuota is NOT a function:', chatService.getQuota);
    }
} catch (e) {
    console.error('Error checking getQuota:', e);
}
