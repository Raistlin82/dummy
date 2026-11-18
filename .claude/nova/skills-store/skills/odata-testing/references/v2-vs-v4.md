# OData V2 vs V4 Comparison

| Aspect | V2 | V4 |
| --- | --- | --- |
| **Service URL** | `/sap/opu/odata/sap/SERVICE_SRV` | `/sap/opu/odata4/sap/SERVICE/srvd_a2x/sap/SERVICE/0001` |
| **Metadata** | `$metadata` returns EDMX XML | `$metadata` returns EDMX V4 XML |
| **Entity key** | `EntitySet('key')` | `EntitySet('key')` or `EntitySet(KeyProp=value)` |
| **Composite key** | `EntitySet(Key1='a',Key2='b')` | `EntitySet(Key1='a',Key2='b')` |
| **CSRF fetch** | `HEAD` with `X-CSRF-Token: Fetch` | `HEAD` with `X-CSRF-Token: Fetch` |
| **CSRF send** | `X-CSRF-Token: <token>` | `X-CSRF-Token: <token>` |
| **Batch URL** | `$batch` | `$batch` |
| **Batch format** | `multipart/mixed` with changesets | JSON (`application/json`) |
| **Create** | `POST /EntitySet` | `POST /EntitySet` |
| **Update** | `PUT /EntitySet('key')` (full replace) | `PATCH /EntitySet('key')` (partial) |
| **Delete** | `DELETE /EntitySet('key')` | `DELETE /EntitySet('key')` |
| **Filter** | `$filter=Field eq 'value'` | `$filter=Field eq 'value'` |
| **Expand** | `$expand=NavProp` | `$expand=NavProp($select=Field1,Field2)` |
| **Inline count** | `$inlinecount=allpages` | `$count=true` |
| **Skip/Top** | `$skip=0&$top=20` | `$skip=0&$top=20` |
| **Function import** | `GET /FunctionName?Param='val'` | `POST /FunctionName` with JSON body |
| **Action** | Not supported | `POST /ActionName` |
| **Error format** | XML or JSON `{ error: { message: { value } } }` | JSON `{ error: { message } }` |
| **Deep insert** | Limited (navigation property) | Full deep insert with nested entities |
| **ETag** | `If-Match` header | `If-Match` header |
| **UI5 model class** | `sap.ui.model.odata.v2.ODataModel` | `sap.ui.model.odata.v4.ODataModel` |
