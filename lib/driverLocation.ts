import { z } from 'zod';

const headingSchema = z.number().finite().min(0).max(360);
const speedSchema = z.number().finite().min(0).max(130);

export const driverLocationPayloadSchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
  heading: z.union([headingSchema, z.null()]).optional(),
  speed_mph: z.union([speedSchema, z.null()]).optional(),
});

export type DriverLocationPayload = z.infer<typeof driverLocationPayloadSchema>;

export type DriverLocationRow = {
  id: string;
  driver_id: string;
  company_id?: string | null;
  lat: number | null;
  lng: number | null;
  heading?: number | null;
  speed_mph?: number | null;
  recorded_at: string | null;
};

export function parseDriverLocationPayload(body: unknown) {
  return driverLocationPayloadSchema.safeParse(body);
}

export function hasCoordinates(
  row: Pick<DriverLocationRow, 'lat' | 'lng'>
): row is Pick<DriverLocationRow, 'lat' | 'lng'> & { lat: number; lng: number } {
  return Number.isFinite(row.lat) && Number.isFinite(row.lng);
}
