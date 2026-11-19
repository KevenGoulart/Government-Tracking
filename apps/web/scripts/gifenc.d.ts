// Tipos mínimos do pacote gifenc (usado só pelo script de capturas do README).
declare module 'gifenc' {
  type Paleta = number[][];
  interface Gifenc {
    quantize: (rgba: Uint8Array, cores: number) => Paleta;
    applyPalette: (rgba: Uint8Array, paleta: Paleta) => Uint8Array;
    GIFEncoder: () => {
      writeFrame(
        indices: Uint8Array,
        largura: number,
        altura: number,
        opcoes: { palette: Paleta; delay: number },
      ): void;
      finish(): void;
      bytes(): Uint8Array;
    };
  }
  const gifenc: Gifenc;
  export default gifenc;
}
