// Compressão de PDF com Ghostscript (WebAssembly), em segundo plano para não travar a página.
import initGS from './vendor/gs/gs.mjs';

self.onmessage = async ({ data: { data, q } }) => {
  const logs = [];
  try {
    const gs = await initGS({
      locateFile: f => new URL('./vendor/gs/' + f, self.location.href).href,
      print: t => logs.push(t),
      printErr: t => logs.push(t),
    });
    gs.FS.writeFile('in.pdf', new Uint8Array(data));
    const dpi = Math.round(50 + q * 2.5);          // qualidade 1..100 vira 52..300 dpi
    const qf = (0.9 - q * 0.008).toFixed(3);       // fator JPEG: 0.1 (melhor) a 0.9 (menor)
    const dict = `/QFactor ${qf} /Blend 1 /HSamples [2 1 1 2] /VSamples [2 1 1 2]`;
    const params = `<< /ColorACSImageDict << ${dict} >> /GrayACSImageDict << ${dict} >> >> setdistillerparams`;
    const mono = Math.min(600, dpi * 2);
    try {
      gs.callMain(['-sDEVICE=pdfwrite', '-dCompatibilityLevel=1.4', '-dNOPAUSE', '-dBATCH', '-dQUIET', '-dSAFER',
        '-dPassThroughJPEGImages=false', '-dDetectDuplicateImages=true', '-dCompressFonts=true', '-dSubsetFonts=true',
        '-dDownsampleColorImages=true', `-dColorImageResolution=${dpi}`, '-dColorImageDownsampleType=/Bicubic', '-dColorImageDownsampleThreshold=1.0',
        '-dDownsampleGrayImages=true', `-dGrayImageResolution=${dpi}`, '-dGrayImageDownsampleType=/Bicubic', '-dGrayImageDownsampleThreshold=1.0',
        '-dDownsampleMonoImages=true', `-dMonoImageResolution=${mono}`,
        '-dAutoFilterColorImages=false', '-dColorImageFilter=/DCTEncode', '-dAutoFilterGrayImages=false', '-dGrayImageFilter=/DCTEncode',
        '-sOutputFile=out.pdf', '-c', params, '-f', 'in.pdf']);
    } catch (e) { logs.push(String(e && e.message || e)); }
    let out;
    try { out = gs.FS.readFile('out.pdf'); } catch { out = null; }
    if (!out || !out.length) throw new Error('Não consegui comprimir este PDF (pode estar protegido por senha ou corrompido). ' + logs.slice(-2).join(' '));
    self.postMessage({ ok: true, data: out.buffer }, [out.buffer]);
  } catch (e) {
    self.postMessage({ ok: false, error: String(e && e.message || e) });
  }
};
