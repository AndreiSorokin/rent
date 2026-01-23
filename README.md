Missing:
StoreUserController (invites & permissions)
Pavilion CRUD endpoints
Payment aggregation endpoints
File upload handling
Dashboard queries


main hierarhy:
Store
 ├── Pavilion[]
 └── StoreUser[]
       └── User

todo:
1.add password strength
2.


Clarification:
1. We use Permission-based access control 
2.

Suggestions:
1. Add role presets later (MANAGER - edit pavilions, charges, contracts or ACCOUNTANT - payments only)
2. If you delete store or pavilion it will go to "recently deleted" section where you can restore them if they have been deleted by mistake