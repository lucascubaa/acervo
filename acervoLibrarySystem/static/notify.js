class Notify {
    constructor() {
        this.container = document.getElementById('notification-container');
        if (!this.container) {
            console.error('Contêiner de notificações não encontrado.');
        }
    }

    show(message, type = 'success') {
        if (!this.container) return;
        if (!message || typeof message !== 'string' || message.trim() === '') {
            console.warn('Mensagem de notificação inválida ou vazia.');
            return;
        }

        const validTypes = ['success', 'error'];
        const notificationType = validTypes.includes(type) ? type : 'success';

        const notification = document.createElement('div');
        notification.className = `notification ${notificationType}`;
        notification.textContent = message.trim();
        this.container.appendChild(notification);

        setTimeout(() => notification.remove(), 3000);
    }
}