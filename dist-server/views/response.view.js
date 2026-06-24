export const ResponseView = {
    sendSuccess(res, data, message = 'Operation completed successfully', statusCode = 200) {
        res.status(statusCode).json({
            success: true,
            message,
            data
        });
    },
    sendError(res, error, message = 'An error occurred during operation', statusCode = 500) {
        const errorDetails = error instanceof Error ? error.message : error;
        res.status(statusCode).json({
            success: false,
            message,
            error: errorDetails
        });
    }
};
