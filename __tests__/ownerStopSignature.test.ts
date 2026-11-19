import {describe,it,expect} from 'vitest';
import sharp from 'sharp';
import {validateOwnerStopSignature} from '../lib/jobs/ownerStopSignature';
const encode=(b:Buffer)=>'data:image/png;base64,'+b.toString('base64');
describe('Owner stop signature validation',()=>{
it('rejects blank PNG and arbitrary payloads',async()=>{const blank=await sharp({create:{width:100,height:60,channels:3,background:'#fff'}}).png().toBuffer();expect(await validateOwnerStopSignature(encode(blank))).toBe(false);expect(await validateOwnerStopSignature('not a signature')).toBe(false);expect(await validateOwnerStopSignature('data:image/png;base64,AA==')).toBe(false)});
it('accepts a bounded PNG with visible dark strokes',async()=>{const png=await sharp(Buffer.from('<svg width="100" height="60"><rect width="100" height="60" fill="white"/><path d="M10 10 L50 40 L90 12" stroke="black" stroke-width="3" fill="none"/></svg>')).png().toBuffer();expect(await validateOwnerStopSignature(encode(png))).toBe(true)});
});
