/** Largest-Triangle-Three-Buckets downsampling for chart line series. */

export const CHART_MAX_LINE_POINTS = 1000;
export const CHART_MARKER_DENSE_BAR_THRESHOLD = 2000;
export const CHART_MAX_VISIBLE_MARKERS = 100;

export function downsampleLttb<T>(data: T[], threshold: number, yValue: (row: T) => number): T[] {
  const target = Math.max(2, Math.floor(threshold));
  if (data.length <= target) return data;

  const sampled: T[] = [data[0]!];
  const bucketSize = (data.length - 2) / (target - 2);
  let previousIndex = 0;

  for (let bucket = 0; bucket < target - 2; bucket += 1) {
    const bucketStart = Math.floor((bucket + 1) * bucketSize) + 1;
    const bucketEnd = Math.min(Math.floor((bucket + 2) * bucketSize) + 1, data.length);
    const bucketLength = Math.max(1, bucketEnd - bucketStart);

    let avgX = 0;
    let avgY = 0;
    for (let index = bucketStart; index < bucketEnd; index += 1) {
      avgX += index;
      avgY += yValue(data[index]!);
    }
    avgX /= bucketLength;
    avgY /= bucketLength;

    const rangeStart = Math.floor(bucket * bucketSize) + 1;
    const rangeEnd = Math.floor((bucket + 1) * bucketSize) + 1;

    let maxArea = -1;
    let maxIndex = rangeStart;

    for (let index = rangeStart; index < rangeEnd; index += 1) {
      const area = Math.abs(
        (previousIndex - avgX) * (yValue(data[index]!) - yValue(data[previousIndex]!)) -
          (previousIndex - index) * (avgY - yValue(data[previousIndex]!)),
      );
      if (area > maxArea) {
        maxArea = area;
        maxIndex = index;
      }
    }

    sampled.push(data[maxIndex]!);
    previousIndex = maxIndex;
  }

  sampled.push(data[data.length - 1]!);
  return sampled;
}
