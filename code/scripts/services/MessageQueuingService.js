function MessageQueuingService() {
    this.getNextMessagesBlock = function (messages, callback) {
        let queue = [];

        let letQueuePass = () => {
            callback(undefined, queue);
        }

        for (let i = 0; i < messages.length; i++) {
            let message = messages[i];
            queue.push(message);
        }
        letQueuePass();
    }
}

let instance = null;
const getMessageQueuingServiceInstance = () => {
    if (!instance) {
        instance = new MessageQueuingService();
    }

    return instance;
}

export {getMessageQueuingServiceInstance}