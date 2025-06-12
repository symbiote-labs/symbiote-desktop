# Plan: Fix TypeScript Errors in Symbiote Desktop

## Checklist

- [x] **Fix 1:** Remove or correct the import of `addAssistantMessagesToTopic` in `SymbioteInputbar.tsx`
- [x] **Fix 2:** Add `isPreset` property to the `Message` type (if appropriate) or update usage in `SymbioteMessage.tsx`
- [x] **Fix 3:** Add `hideMessages` to `AssistantSettings` type in `types/index.ts` (if appropriate) and update related code
- [x] **Fix 4:** Remove unused import `ORIGIN_DEFAULT_MIN_APPS` in `SymbioteSettingsPage.tsx`
- [x] **Fix 5:** Remove `hideMessages` from the object literal in `symbioteConfig.ts` if not in type, or add to type if needed

---

### Details

#### Fix 1: `addAssistantMessagesToTopic` Import Error
- **File:** `src/renderer/src/pages/home/Inputbar/SymbioteInputbar.tsx`
- **Error:** `addAssistantMessagesToTopic` is not exported from `@renderer/services/AssistantService`.
- **Action:** Remove the import if not used, or replace with the correct function.

#### Fix 2: `isPreset` Property on `Message`
- **File:** `src/renderer/src/pages/home/Messages/SymbioteMessage.tsx`
- **Error:** `Property 'isPreset' does not exist on type 'Message'`.
- **Action:** If `isPreset` is a real property, add it to the `Message` type. If not, update the code to not use it.

#### Fix 3: `hideMessages` on `AssistantSettings`
- **Files:** 
  - `src/renderer/src/pages/home/Messages/SymbioteMessages.tsx`
  - `src/renderer/src/utils/symbioteConfig.ts`
- **Error:** `hideMessages` does not exist on type `Partial<AssistantSettings>`.
- **Action:** If `hideMessages` is a real setting, add it to `AssistantSettings` in `types/index.ts`. Otherwise, remove its usage.

#### Fix 4: Unused Import
- **File:** `src/renderer/src/pages/home/SymbioteSettingsPage.tsx`
- **Error:** `'ORIGIN_DEFAULT_MIN_APPS' is declared but its value is never read.`
- **Action:** Remove the unused import.

#### Fix 5: Object Literal May Only Specify Known Properties
- **File:** `src/renderer/src/utils/symbioteConfig.ts`
- **Error:** `'hideMessages' does not exist in type 'Partial<AssistantSettings>'`.
- **Action:** Remove `hideMessages` from the object literal if not needed, or add it to the type. 