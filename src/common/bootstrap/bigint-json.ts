export function enableBigIntJsonSerialization() {
  (BigInt.prototype as unknown as { toJSON: () => string }).toJSON =
    function toJSON() {
      return this.toString();
    };
}
