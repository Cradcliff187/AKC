const EstimateStatusManager = {
  validateTransition: (currentStatus, newStatus) => {
    const transitions = window.CONSTANTS.ESTIMATE_STATUSES;
    const allowedTransitions = {
      DRAFT: ['PENDING', 'CANCELLED'],
      PENDING: ['APPROVED', 'REJECTED', 'CANCELLED'],
      APPROVED: ['COMPLETED', 'CANCELLED'],
      REJECTED: ['DRAFT', 'CANCELLED'],
      COMPLETED: ['CLOSED'],
      CANCELLED: [],
      CLOSED: []
    };
    return allowedTransitions[currentStatus]?.includes(newStatus);
  },

  executeTransition: async (estimateId, newStatus, currentStatus) => {
    // Execute before transition hooks
    await logActivity({
      action: 'STATUS_CHANGE',
      moduleType: 'ESTIMATE',
      referenceId: estimateId,
      details: { oldStatus: currentStatus, newStatus }
    });

    const result = await google.script.run
      .withSuccessHandler(response => response)
      .withFailureHandler(error => {
        throw new Error(error.message || 'Status update failed');
      })
      .updateEstimateStatusForClient({
        estimateId,
        newStatus,
        currentStatus
      });

    // Execute after transition hooks
    await syncProjectStatus(estimateId, newStatus);
    return result;
  }
};