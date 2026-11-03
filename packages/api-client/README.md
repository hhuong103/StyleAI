# API client contract

`schema.d.ts` được sinh từ `contracts/openapi.json` bằng openapi-typescript, không sửa trực tiếp. Frontend transport ở `apps/web/src/lib/api.ts` quản lý same-origin cookies, CSRF, refresh single-flight và API errors. `apps/web/src/lib/types.ts` chứa view models cho UI; các output schema quan trọng cũng được khai báo bằng Pydantic để OpenAPI có kiểu dữ liệu cụ thể.

Chạy export/generate như hướng dẫn local-development. CI kiểm tra schema/type drift bằng `git diff`.
