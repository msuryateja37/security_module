import { Response } from 'express';

export const ResponseView = {
  sendSuccess<T>(
    res: Response,
    data: T,
    message: string = 'Operation completed successfully',
    statusCode: number = 200
  ): void {
    res.status(statusCode).json({
      success: true,
      message,
      data
    });
  },

  sendError(
    res: Response,
    error: string | Error,
    message: string = 'An error occurred during operation',
    statusCode: number = 500
  ): void {
    const errorDetails = error instanceof Error ? error.message : error;
    res.status(statusCode).json({
      success: false,
      message,
      error: errorDetails
    });
  }
};
