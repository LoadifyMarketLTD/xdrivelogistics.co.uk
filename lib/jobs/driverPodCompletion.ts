/**
 * Photo uploads are staged evidence, not proof that delivery was signed off.
 * The canonical record_driver_pod_atomic RPC sets this flag only after POD
 * submission; consumers must not infer completion from delivery_photos.
 */
export function isDriverPodComplete(job: { pod_generated?: boolean | null }): boolean {
  return job.pod_generated === true;
}
