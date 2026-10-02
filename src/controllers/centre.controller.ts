import { Request, Response, NextFunction } from 'express';
import * as centreService from '../services/centre.service';
import { successResponse } from '../utils/response';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const { centres, pagination, cacheHit } = await centreService.listCentres(req.query as any);
    res.setHeader('X-Cache', cacheHit ? 'HIT' : 'MISS');
    successResponse(res, centres, 200, pagination as any);
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const { centre, cacheHit } = await centreService.getCentreById(req.params.id as string);
    res.setHeader('X-Cache', cacheHit ? 'HIT' : 'MISS');
    successResponse(res, centre);
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const centre = await centreService.createCentre(req.body);
    successResponse(res, centre, 201);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const centre = await centreService.updateCentre(req.params.id as string, req.body);
    successResponse(res, centre);
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await centreService.deleteCentre(req.params.id as string);
    successResponse(res, { message: 'Centre deleted' });
  } catch (err) {
    next(err);
  }
}
