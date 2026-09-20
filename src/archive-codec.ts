/** Decode the archive's optional cumulative-delta timestamp column.
 *
 * In delta mode the first value is the absolute base timestamp and every
 * subsequent value is an offset from the preceding absolute value.  In
 * absolute mode values are returned unchanged (in a fresh array).
 */
export function decodeTimestamps(
  values: readonly number[],
  isDelta: boolean,
): number[] {
  const out = new Array<number>(values.length);
  let previous = 0;
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];
    if (!Number.isFinite(value)) {
      throw new RangeError(`timestamp at index ${i} is not finite`);
    }
    const decoded = isDelta && i > 0 ? previous + value : value;
    if (!Number.isFinite(decoded)) {
      throw new RangeError(`decoded timestamp at index ${i} is not finite`);
    }
    out[i] = decoded;
    previous = decoded;
  }
  return out;
}
