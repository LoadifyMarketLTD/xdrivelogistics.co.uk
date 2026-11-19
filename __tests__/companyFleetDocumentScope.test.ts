import {describe,it,expect} from 'vitest';
import {fleetDocumentHref,fleetDocumentMatches,fleetDocumentSubjectAllowed} from '../app/components/workspace/companyFleetDocumentScope';
describe('3118 dossier document navigation',()=>{
 it('opens the exact canonical record without changing its identifier',()=>{expect(fleetDocumentHref('vehicle','id with /')).toBe('/admin/documents?type=vehicle&subject=id%20with%20%2F')});
 it('never shows another subject or document kind in a scoped view',()=>{const row={kind:'driver' as const,subject_id:'d1',status:'approved'};expect(fleetDocumentMatches(row,'driver','d1',false)).toBe(true);expect(fleetDocumentMatches(row,'driver','d2',false)).toBe(false);expect(fleetDocumentMatches(row,'vehicle','d1',false)).toBe(false);expect(fleetDocumentMatches(row,'driver','d1',true)).toBe(false)});
 it('allows preselection only from independently loaded company options',()=>{expect(fleetDocumentSubjectAllowed('foreign',[{id:'own'}])).toBe(false);expect(fleetDocumentSubjectAllowed('own',[{id:'own'}])).toBe(true)});
});
