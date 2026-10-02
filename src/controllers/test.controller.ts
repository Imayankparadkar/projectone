import { Request, Response, NextFunction } from 'express';
import * as testService from '../services/test.service';
import { successResponse } from '../utils/response';

// ── Diagnostic Tests ──

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const { tests, pagination, cacheHit } = await testService.listTests(req.query as any);
    res.setHeader('X-Cache', cacheHit ? 'HIT' : 'MISS');
    successResponse(res, tests, 200, pagination as any);
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const { test, cacheHit } = await testService.getTestById(req.params.id as string);
    res.setHeader('X-Cache', cacheHit ? 'HIT' : 'MISS');
    successResponse(res, test);
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const test = await testService.createTest(req.body);
    successResponse(res, test, 201);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const test = await testService.updateTest(req.params.id as string, req.body);
    successResponse(res, test);
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await testService.deleteTest(req.params.id as string);
    successResponse(res, { message: 'Test deleted' });
  } catch (err) {
    next(err);
  }
}

// ── Centre-Test Associations ──

export async function listCentreTests(req: Request, res: Response, next: NextFunction) {
  try {
    const { centreTests, pagination, cacheHit } = await testService.listCentreTests(
      req.params.id as string,
      req.query as any
    );
    res.setHeader('X-Cache', cacheHit ? 'HIT' : 'MISS');
    successResponse(res, centreTests, 200, pagination as any);
  } catch (err) {
    next(err);
  }
}

export async function addCentreTest(req: Request, res: Response, next: NextFunction) {
  try {
    const centreTest = await testService.addCentreTest(req.params.id as string, req.body.testId, req.body.price);
    successResponse(res, centreTest, 201);
  } catch (err) {
    next(err);
  }
}

export async function updateCentreTest(req: Request, res: Response, next: NextFunction) {
  try {
    const centreTest = await testService.updateCentreTest(req.params.id as string, req.params.testId as string, req.body.price);
    successResponse(res, centreTest);
  } catch (err) {
    next(err);
  }
}

export async function removeCentreTest(req: Request, res: Response, next: NextFunction) {
  try {
    await testService.deleteCentreTest(req.params.id as string, req.params.testId as string);
    successResponse(res, { message: 'Centre-test association removed' });
  } catch (err) {
    next(err);
  }
}
