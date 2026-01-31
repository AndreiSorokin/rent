Missing:
File upload handling

After MVP:
1. Add password strength
2. Reset password
3. Forgot password
4. kick from a store
5. Paid subscribtion
6. Add store-level analytics (totals across pavilions)
7. Add store-level analytics (totals across pavilions)



main hierarhy:
Store
 ├── Pavilion[]
 └── StoreUser[]
       └── User


Clarification:
1. We use Permission-based access control 
2. When registering we can select whether it's admin or user

Suggestions:
1. If you delete store or pavilion it will go to "recently deleted" section where you can restore them if they have been deleted by mistake