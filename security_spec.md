# Security Specification — Boonsom 7 Specific Competency Assessment

## 1. Data Invariants
1. **Identity Integrity**: Every `staffProfiles/{userId}` document must have `uid == userId == request.auth.uid` on create (unless created by an admin). Every `assessments/{assessmentId}` document must bind `ownerUid == request.auth.uid` on create and keep `ownerUid` and `createdAt` immutable forever.
2. **Verified Users Only**: All read/write operations require `request.auth != null` and `request.auth.token.email_verified == true`.
3. **Strict Shape & Size Bounds**: Every create must match `hasAll(...) && hasOnly(...)`. Every string has `.size()` bounds. Arrays (`supervisorFeedback`, `selfFeedback`) are bounded to `size() <= 5`. Maps (`selfScores`, `supervisorScores`, `itemMethods`) are bounded to `size() <= 60`.
4. **Temporal Integrity**: `createdAt` on create and `updatedAt` on create/update must equal `request.time`.
5. **Action-Based Updates & Terminal State Locking**:
   - Non-admin staff can only edit their own `draft` or `self_submitted` assessments' self-assessment fields (`selfScores`, `selfTotalScore`, `selfMaxScore`, `selfPercentage`, `selfFeedback`, `selfOtherNote`, `staffName`, `staffAge`, `ward`, `positionType`, `totalYears`, `wardYears`, `assessmentPeriod`, `status`, `updatedAt`). They CANNOT modify `supervisorScores`, `supervisorTotalScore`, `supervisorPercentage`, `supervisorTier`, `supervisorFeedback`, `evaluatorUid`, or `evaluatorName`.
   - Once `status == 'evaluated'` or `'archived'`, non-admins cannot update the assessment.
   - Only Head Nurse / Admins (`isAdmin()`) can perform supervisor evaluations (`supervisorScores`, `supervisorTotalScore`, `supervisorMaxScore`, `supervisorPercentage`, `supervisorTier`, `supervisorFeedback`, `supervisorOtherNote`, `itemMethods`, `evaluatorName`, `evaluatorUid`, `status`) or override evaluated records.
6. **Secure List Queries**: `allow list` never uses `get()` or `exists()`. Non-admins can only list assessments where `resource.data.ownerUid == request.auth.uid || resource.data.staffUid == request.auth.uid`. Bootstrapped Head Nurse admin (`kakura050@gmail.com` with `email_verified == true`) can list all records.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Identity Spoofing on Create**: User A attempts to create an assessment with `ownerUid: "userB_uid"`. -> Rejected (`ownerUid == request.auth.uid`).
2. **Shadow / Ghost Field Injection**: User sends `isVerified: true` or `adminOverride: true` in assessment payload. -> Rejected (`hasOnly(...)`).
3. **Self-Supervisor Score Forgery**: Non-admin staff attempts to update `supervisorScores` or `supervisorPercentage` on their own assessment. -> Rejected (action-based `affectedKeys().hasOnly(...)`).
4. **Post-Evaluation Tampering**: Non-admin staff attempts to modify `selfScores` after `status == 'evaluated'`. -> Rejected (terminal state lock).
5. **Unverified Email Spoof**: Request has `email == 'kakura050@gmail.com'` with `email_verified: false`. -> Rejected (`email_verified == true` check).
6. **ID Poisoning**: Document ID contains `../` or 1,500 random characters. -> Rejected (`isValidId()` regex & length `<= 128`).
7. **Server Timestamp Forgery**: Client passes a backdated `createdAt` or `updatedAt`. -> Rejected (`== request.time`).
8. **Immutable Field Mutation**: User attempts to change `ownerUid`, `formId`, or `createdAt` during an update. -> Rejected (`== existing()`).
9. **Denial of Wallet String Overflow**: User sends a 1MB `supervisorOtherNote` string. -> Rejected (`size() <= 500`).
10. **Unbounded Array Injection**: User sends 100 items in `selfFeedback` array. -> Rejected (`size() <= 5`).
11. **Privilege Escalation on Admins**: Non-admin user attempts to write `/admins/{uid}` to make themselves Head Nurse. -> Rejected (`isAdmin()`).
12. **Blanket Collection Scraping**: Non-admin executes `getDocs(collection(db, 'assessments'))` without owner/staff filter. -> Rejected (`allow list` checks `resource.data.ownerUid == request.auth.uid`).
