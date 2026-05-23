# Security Specification for Random Dance Request App

This document outlines the security invariants, malicious attack vectors ("Dirty Dozen"), and validation rules for the Firebase deployment.

## 1. Data Invariants

1. **Owner-Creator Link**: The `creatorId` of any `songRequest` must exactly match the `request.auth.uid` of the authenticated user.
2. **Immutable Identity**: A song request's `creatorId`, `creatorEmail`, and `createdAt` cannot be modified after creation.
3. **Admin Actions Only**: Only the organizer (`Digimon.Angelique@gmail.com`) can delete requests or update the `status` of requests to `approved`, `rejected`, or `played`.
4. **Verified Voting**: A user can only vote for a song by writing to the subcollection path `/songRequests/{requestId}/votes/{userId}`, where `{userId}` matches their own authenticated `request.auth.uid`. No user can vote on behalf of someone else.
5. **No Negative / Unreasonable Ratings**: The initial `votesCount` of a new request must be exactly `1`.
6. **Strict Timestamps**: Creation and updating timestamps must be bound directly to the server side `request.time`.

---

## 2. The "Dirty Dozen" Malicious Payloads

The following scenarios must be rejected with `PERMISSION_DENIED` by our security rules.

### Payload 1: Unauthenticated Creation
An unauthenticated user attempts to request a song.
* **Path**: `/songRequests/attack_song_01`
* **Payload**:
  ```json
  {
    "id": "attack_song_01",
    "title": "Unauthenticated Song",
    "artist": "Hacker",
    "creatorId": "some_uid",
    "creatorName": "Anonym",
    "creatorEmail": "anon@hack.com",
    "votesCount": 1,
    "status": "pending",
    "createdAt": "2026-05-22T20:25:00Z",
    "updatedAt": "2026-05-22T20:25:00Z"
  }
  ```

### Payload 2: UID Spoofing
An authenticated user attempts to create a song request but sets the `creatorId` to a different user's UID.
* **Auth**: User custom UID `hacker_user_456`, Email: `hacker@hack.com`
* **Path**: `/songRequests/attack_song_02`
* **Payload**:
  ```json
  {
    "id": "attack_song_02",
    "title": "Spoofed Song",
    "artist": "Imposter",
    "creatorId": "victim_user_123",
    "creatorName": "Victim",
    "creatorEmail": "victim@innocent.com",
    "votesCount": 1,
    "status": "pending",
    "createdAt": "2026-05-22T20:25:00Z",
    "updatedAt": "2026-05-22T20:25:00Z"
  }
  ```

### Payload 3: Instant Vote Inflation on Create
A user attempts to submit a song request with internal starting count of 10,000 votes.
* **Auth**: User UID `dance_fan_01`, Email: `user@dance.com`
* **Path**: `/songRequests/vote_hack_01`
* **Payload**:
  ```json
  {
    "id": "vote_hack_01",
    "title": "Super Popular Song",
    "artist": "Famous",
    "creatorId": "dance_fan_01",
    "creatorName": "Dance Fan",
    "creatorEmail": "user@dance.com",
    "votesCount": 10000,
    "status": "pending",
    "createdAt": "2026-05-22T20:25:00Z",
    "updatedAt": "2026-05-22T20:25:00Z"
  }
  ```

### Payload 4: Arbitrary Status Approval by Standard User
A user attempts to post a song that is already pre-approved or sets pre-approved status on their own.
* **Auth**: User UID `dance_fan_02`
* **Path**: `/songRequests/approved_hack`
* **Payload**:
  ```json
  {
    "id": "approved_hack",
    "title": "Self-Approved Banger",
    "artist": "Dance Crew",
    "creatorId": "dance_fan_02",
    "creatorName": "Lover",
    "creatorEmail": "lover@dance.com",
    "votesCount": 1,
    "status": "approved",
    "createdAt": "2026-05-22T20:25:00Z",
    "updatedAt": "2026-05-22T20:25:00Z"
  }
  ```

### Payload 5: Timestamp Modification on Edit
An authenticated creator attempts to change the `createdAt` timestamp of their song.
* **Auth**: User UID `dance_fan_02`
* **Path**: `/songRequests/approved_hack`
* **Original**: `createdAt = request.time`
* **Payload**: Modify field `createdAt` to "2020-01-01T00:00:00Z".

### Payload 6: Spoofing Creator Identity of Another's Song Request on Update
A user attempts to modify the `title` or `artist` of another user's song request.
* **Auth**: User UID `attacker_999`
* **Path**: `/songRequests/user_original_song_88` (created by `user_88`)
* **Payload**: Modify title to "Hacked Title".

### Payload 7: Double Voting / Sibling Vote Subcollection Impersonation
A user attempts to record a vote document in the `/votes` subcollection using another user's ID as the document ID.
* **Auth**: User UID `voter_attacker`
* **Path**: `/songRequests/song_123/votes/innocent_voter_uid`
* **Payload**:
  ```json
  {
    "voterId": "innocent_voter_uid",
    "voterName": "Innocent",
    "createdAt": "2026-05-22T20:25:00Z"
  }
  ```

### Payload 8: Vote Timestamp Discrepancy
A voter attempts to write a vote with custom (past or future) timestamps.
* **Auth**: User UID `voter_user`
* **Path**: `/songRequests/song_123/votes/voter_user`
* **Payload**:
  ```json
  {
    "voterId": "voter_user",
    "voterName": "Voter",
    "createdAt": "2010-01-01T00:00:00Z"
  }
  ```

### Payload 9: Unauthorized Approval / Status Lock Override
A standard user attempts to transition the status of a request from 'pending' to 'approved'.
* **Auth**: Standard User UID `voter_user`
* **Path**: `/songRequests/song_abc`
* **Payload**:
  ```json
  { "status": "approved" }
  ```

### Payload 10: Deletion by Non-Admin
A standard user attempts to delete a song request. Only admins (organizers) should be able to hard delete requests.
* **Auth**: Standard User UID `dance_fan_01`
* **Path**: `/songRequests/song_abc`
* **Action**: Delete document.

### Payload 11: Junk ID Poisoning
An attacker attempts to create a request with a very long document ID containing special characters.
* **Path**: `/songRequests/$$$$$_HACKED_BY_BAD_ACTOR_LONG_ID_A_A_A_A_A_A_A_A_A_A_A_A_A_A_A_A_`
* **Payload**: Normal creation schema.

### Payload 12: Admin Self-Assignment
A user attempts to write to a hypothetical admin document or bypass admin verification.
* **Auth**: Standard User
* **Path**: `/admins/hacked_uid`
* **Action**: Create document to make themselves admin.

---

## 3. The Test Runner

These assertions will be verified using our Firestore Security Rules.
All writes attempting the above payloads will be rejected.
Only authenticated, verified users are allowed to execute creations and votes, and only the Bootstrap Admin `Digimon.Angelique@gmail.com` can execute administrative updates and deletions.
