type SubjectKind='driver'|'vehicle';
export function fleetDocumentHref(kind:SubjectKind,id:string){
 return '/admin/documents?type='+kind+'&subject='+encodeURIComponent(id);
}
export function fleetDocumentMatches(row:{kind:SubjectKind;subject_id:string;status:string},kind:SubjectKind,subject:string|null,pendingOnly:boolean){
 return row.kind===kind&&(!subject||row.subject_id===subject)&&(!pendingOnly||row.status==='pending');
}
export function fleetDocumentSubjectAllowed(subject:string|null,options:{id:string}[]){
 return Boolean(subject&&options.some(option=>option.id===subject));
}
