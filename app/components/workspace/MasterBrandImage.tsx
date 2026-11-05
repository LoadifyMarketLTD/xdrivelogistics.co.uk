import Image from 'next/image';
/** Approved XDrive Master Workspace mark, shared by all role shells. */
export default function MasterBrandImage({priority=false}:{priority?:boolean}){
 return <Image src="/xdrive-logo-company-3150.png" alt="XDrive Logistics" width={196} height={64} priority={priority}/>;
}
