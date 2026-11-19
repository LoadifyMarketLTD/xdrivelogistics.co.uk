import {describe,it,expect} from 'vitest';
import {safeOwnerDocumentUrl} from '../app/driver/_components/ownerDocumentPresentation';
describe('Owner job document navigation',()=>{
 it('accepts signed private load attachment links',()=>expect(safeOwnerDocumentUrl('https://fixture.supabase.co/storage/v1/object/sign/load-documents/a/b/test.pdf?token=fixture')).toContain('test.pdf'));
 it.each(['javascript:alert(1)','https://example.com/storage/v1/object/sign/load-documents/a?token=x','https://fixture.supabase.co/storage/v1/object/public/load-documents/a?token=x','https://fixture.supabase.co/storage/v1/object/sign/load-documents/a','a/b/test.pdf',null])('rejects unsafe or non-signed URL %s',value=>expect(safeOwnerDocumentUrl(value)).toBeNull());
});
