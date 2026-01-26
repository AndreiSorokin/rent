Missing:
StoreUserController (invites & permissions)
Pavilion page???
Pavilion CRUD endpoints
Payment aggregation endpoints
File upload handling
Dashboard queries

After MVP:
1. Add password strength
2. Reset password
3. Forgot password



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