# NFS email template previews

Open any .html file in a browser to preview.

| ID | Name | Trigger | Audience |
| --- | --- | --- | --- |
| `welcome` | Welcome / signup | User registers (student, alumni, or admin) | New member |
| `otp` | Email verification OTP | Signup or re-verify email | New / unverified member |
| `password-reset` | Password reset request | Forgot password | Member |
| `password-reset-success` | Password reset success | Password successfully changed | Member |
| `newsletter-welcome` | Newsletter subscription | Footer / newsletter subscribe | Subscriber |
| `job-application-received` | Job application received | POST /jobs/:id/applications | Applicant |
| `job-application-admin` | Job application (admin) | Same as above | Admin / careers team |
| `scholarship-application-received` | Scholarship application received | POST /scholarships/:id/applications | Applicant |
| `scholarship-application-admin` | Scholarship application (admin) | Same as above | Admin / awards team |
| `event-rsvp-confirmation` | Event RSVP confirmation | POST /events/:id/rsvp | Attendee |
| `donation-thank-you` | Donation thank you | POST /support/:id/donations | Donor |
| `marketplace-enquiry-received` | Marketplace enquiry confirmation | POST /marketplace/:id/enquiries | Buyer |
| `marketplace-enquiry-seller` | Marketplace enquiry (seller) | Same as above | Seller / admin |
| `community-join-confirmation` | Community / year-group join | POST join on community or year-groups | Member |
| `mentorship-request-received` | Mentorship request confirmation | POST /alumni/mentors/:id/requests | Mentee |
| `mentorship-request-mentor` | Mentorship request (mentor) | Same as above | Mentor |
| `alumni-connect-request` | Alumni connect request | POST /alumni/profiles/:id/connect | Alumni profile owner |
| `admin-invite` | Admin invitation | Admin creates access user | New admin |
| `status-update` | Generic status update | Admin reviews application / request | Member |
| `broadcast-news` | News broadcast | Publish news with Notify subscribers / POST broadcast | Subscribers + members |
| `broadcast-event` | Event broadcast | Publish event with Notify subscribers / POST broadcast | Subscribers + members |
| `broadcast-scholarship` | Scholarship broadcast | Publish scholarship with Notify subscribers / POST broadcast | Subscribers + members |
| `broadcast-job` | Job broadcast | Publish job with Notify subscribers / POST broadcast | Subscribers + members |
