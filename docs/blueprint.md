# **App Name**: Pharma Flash

## Core Features:

- Data Display: Display drug information (drug name, class, mechanism, uses, side effects, fun fact) in a table layout for the selected date.
- Date Navigation: Allow users to navigate through dates via a horizontal date list to view past drug highlights.
- Firestore Integration: Store and retrieve drug highlight data using Firestore with the date as the document ID.
- PIN-Protected Edit Mode: Enable edit mode via a PIN popup, allowing modification of drug data and saving back to Firestore.
- Automatic Date Loading: Automatically load today's drug highlight or display blank fields if no data exists for the current date.

## Style Guidelines:

- Primary color: Light beige (#F5F5DC) to mimic a medical document background.
- Background color: Off-white (#FAFAFA), a lighter tint of beige to create subtle contrast without stark difference.
- Accent color: Soft blue (#A6BCE3) for interactive elements such as date selections and button highlights.
- Additional accent color: Light purple (#E0BBE4) for secondary interactive elements or subtle highlights, providing a calming and professional feel.
- Font: 'Literata' serif for body and headers. Note: currently only Google Fonts are supported.
- Fixed layout resembling a department notice sheet with clear sections for the title, drug information table, and date navigation.
- Use borders around tables and a slight grey border (#D3D3D3) around the whole page for a clean, sectioned look.
- Minimalistic iconography, with icons limited to basic affordances like 'edit', 'save' or 'confirm'. Using basic unicode characters like a pencil may be preferred over dedicated icon images, to reduce dependency overhead and complexity.