// Temporary placeholder for queue service
export const queueService = {
  enqueue: async (jobType: string, payload: any, priority: number = 5) => {
    console.log('Queue service placeholder - enqueue:', jobType);
    return 'placeholder-job-id';
  }
};

export default queueService;