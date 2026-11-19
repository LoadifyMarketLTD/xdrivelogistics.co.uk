import sharp from 'sharp';
/** Reject malformed, oversized or entirely blank image payloads. This checks evidence, not the identity of the signer. */
export async function validateOwnerStopSignature(value:unknown):Promise<boolean>{
 if(typeof value!=='string'||value.length>250000||!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value))return false;
 try{const img=sharp(Buffer.from(value.slice('data:image/png;base64,'.length),'base64'),{limitInputPixels:500000});const meta=await img.metadata();if(meta.format!=='png'||!meta.width||!meta.height||meta.width>1000||meta.height>500)return false;
 const {data}=await img.flatten({background:'#fff'}).removeAlpha().raw().toBuffer({resolveWithObject:true});let ink=0;for(let i=0;i<data.length;i+=3){if(data[i]<180&&data[i+1]<180&&data[i+2]<180)ink++;}return ink>=12;
 }catch{return false;}
}
