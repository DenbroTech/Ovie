# Ovie — product brief

(Originally written as "Home Hub"; the app is called Ovie.)

MASTER PROJECT PROMPT — HOME HUB
Build a complete, polished, self-hosted household management application for Raspberry Pi
You are my senior software architect, full-stack developer, UI/UX designer, database engineer and deployment specialist.
Your job is to help me design, build, test and deploy a fully functional household management application called Home Hub. This is a real software project, not a mock-up, concept demo or disposable prototype.
I have a touchscreen mounted inside a frame and connected to a Raspberry Pi. The display will act as a permanent household dashboard. I also want to access and update the same information from our phones when connected to our home Wi-Fi.
I want to build something that feels like a purpose-built household appliance: beautiful, intuitive, reliable, fast, touch-friendly and genuinely useful every day.
I am looking for practical implementation, not endless discussion or generic advice. Make sensible engineering decisions, explain important choices briefly and then implement the application in working increments.
1. THE VISION
Home Hub is a shared household command centre combining:

* A household diary and calendar.
* To-do lists and recurring household jobs.
* Shared shopping lists.
* TV series and film tracking.
* Meal planning and recipes.
* Household notes and reminders.
* Home maintenance and inventory.
* Bills, subscriptions and renewals.
* Future plans and things we want to buy.
* Weather and useful daily information.
* Optional smart-home integrations.
* Future voice input and intelligent quick-add functionality.

The main principle is that these features must work together rather than feel like unrelated applications glued together.
Examples:

* Adding a recipe to the meal planner can add its ingredients to the shopping list.
* Completing a recurring task automatically schedules its next occurrence.
* Adding a television series creates a watchlist entry and tracks episode progress.
* Adding a purchase can optionally record its price, delivery status and warranty.
* Creating a calendar event can include preparation tasks and a linked shopping list.
* A household maintenance record can generate a reminder for its next service date.

The application must be useful even without internet access, apart from features that inherently need an external service.
Do not turn this into an unnecessarily complicated enterprise application. Prioritise everyday usability and reliable functionality.
2. DEVELOPMENT PRINCIPLES
Follow these rules throughout the project.

1. Build a working application, not merely an attractive interface.
2. Use real persistent database storage from the beginning.
3. Do not use mock data as a substitute for implemented features.
4. Never make buttons that look functional but do nothing.
5. Never claim a feature works unless it has actually been implemented and tested.
6. Avoid unnecessary subscriptions, paid APIs and cloud dependencies.
7. Prefer free and open-source components where practical.
8. Keep the application maintainable, modular and documented.
9. Do not rewrite working code unnecessarily.
10. Preserve existing working features when implementing new ones.
11. Do not introduce complicated infrastructure without a clear benefit.
12. Do not require me to understand advanced software engineering to follow your instructions.
13. When terminal commands are necessary, prefer Windows Command Prompt-compatible commands unless I explicitly say I am working directly on the Raspberry Pi.
14. Never expose API keys, passwords or other secrets in source code or Git.
15. If you encounter an existing project, inspect it before modifying it. Do not blindly overwrite files.

If an important detail is unknown, make a reasonable, reversible assumption and document it. Ask me a question only when proceeding would create a significant architectural or functional problem.
3. TECHNOLOGY STACK
Use the following as the default architecture unless an inspection or genuine technical limitation demonstrates that a change is necessary.
Frontend

* React.
* TypeScript.
* Vite.
* A modern, consistent component system.
* Responsive layouts for the framed touchscreen, desktop browsers and mobile phones.
* Accessible controls and proper touch interaction.

Backend

* Node.js.
* TypeScript.
* A lightweight HTTP API using a maintained framework such as Fastify or Express.
* Clear separation between API routes, application logic and database operations.

Database

* SQLite for persistent local storage.
* Proper relational tables, foreign keys, indexes and migrations.
* Transactions for operations involving multiple related records.
* Database backups and restoration procedures.
* Store dates and times consistently, with appropriate timezone handling.

Deployment

* Raspberry Pi hosts the application and database.
* The touchscreen opens the app in a dedicated Chromium kiosk session.
* Other devices on the home network access the same application through a browser.
* The application should launch automatically on boot.
* The display should recover sensibly after power loss, browser failure or temporary network issues.
* Do not expose the application directly to the public internet by default.

Engineering

* Use a clear repository structure.
* Use environment variables for configuration.
* Include a documented installation and deployment process.
* Provide health checks and useful error logs.
* Include automated tests for important functionality.
* Pin and document compatible dependency versions.
* Choose Node.js and package versions that are compatible with the Raspberry Pi operating system and architecture.

Before implementation, verify the actual target hardware, operating system and architecture if they are available. Do not assume the Raspberry Pi model or touchscreen resolution.
If the Pi cannot comfortably run the selected stack, explain the issue and recommend the smallest practical adjustment.
4. USERS AND PERMISSIONS
Initially, there are two household members.
Support:

* Individual user profiles.
* A shared household.
* Tasks assigned to either person or both.
* Shared and individual calendars.
* Shared shopping lists.
* Individual and shared television viewing histories.
* A distinction between personal notes and household notes where appropriate.

The app must make it obvious who a task belongs to and who completed it.
Do not assume both users always want the same data displayed.
The touchscreen should have a household-friendly interface without repeatedly demanding login credentials. Phone access should have an appropriate security mechanism if individual accounts are supported.
Do not implement a fake security system. Document what protection is provided, and protect all write operations against unauthorised access on the network.
Design the data model so more household members can be added later without restructuring the entire database.
5. MAIN DASHBOARD
The dashboard is the heart of Home Hub.
Design it as a polished, information-dense but uncluttered household control panel.
It should include:

* Current date and time.
* A welcoming but unobtrusive header.
* Today's calendar events.
* Upcoming appointments.
* Outstanding high-priority tasks.
* A preview of the shopping list.
* A preview of the current television watchlist.
* The next household reminder.
* Optional weather information.
* Quick-add controls.
* Clear navigation to all main sections.

The dashboard must not attempt to display every record at once.
Use cards, panels and compact previews. Prioritise what is relevant today and allow users to drill into detailed sections.
Completed tasks should not dominate the dashboard.
Provide a clear indication when there are no upcoming events or outstanding tasks.
The dashboard should adapt to the available screen size and orientation.
If the touchscreen is large enough, use a multi-column layout. On a phone, use a compact responsive layout with sensible navigation.
Do not hardcode a specific display resolution before learning the actual hardware.
6. DESIGN AND USER EXPERIENCE
The design should feel like a high-quality consumer product, not a generic admin dashboard.
Design direction:

* Modern, warm and sophisticated.
* Calm colours with excellent contrast.
* Consistent spacing and typography.
* Subtle rounded corners and restrained shadows.
* Clear visual hierarchy.
* Large, comfortable touch targets.
* Minimal clutter.
* Smooth but restrained transitions.
* A cohesive icon system.
* A carefully designed dark theme and light theme.
* No excessive gradients, meaningless animations or gratuitous glass effects.

The interface should be comfortable to view from a short distance.
On the touchscreen:

* Controls should be large enough for fingers.
* Avoid hover-dependent functionality.
* Avoid tiny dropdowns.
* Use clear confirmation for destructive actions.
* Use sensible touch-friendly dialogs and forms.
* Make the most common actions possible in one or two taps.
* Prevent accidental double submissions.
* Ensure scrolling and keyboard interaction work correctly.
* Avoid the on-screen keyboard covering important form controls.

On phones:

* Support portrait orientation.
* Make shopping-list interactions particularly fast.
* Make forms compact but usable.
* Keep navigation consistent with the main display.

Include:

* Loading states.
* Empty states.
* Error states.
* Success feedback.
* Confirmation for destructive operations.
* Undo where practical.
* Search and filtering for sections that accumulate many records.

Use a coherent design system with reusable components, tokens and layouts.
Do not create a collection of visually inconsistent pages.
7. MODULE ONE — DIARY AND CALENDAR
Build a proper household calendar.
Features:

* Day, week and month views.
* Create, edit and delete events.
* Event title and description.
* Start and end dates and times.
* All-day events.
* Recurring events.
* Categories and colours.
* Personal versus shared events.
* Optional location.
* Reminders.
* Birthday and anniversary entries.
* Upcoming-events view.
* Search.
* Completed or past event history where useful.

Handle recurring events carefully. Editing one occurrence must not accidentally alter an entire series unless that is explicitly selected.
Avoid duplicate reminders when a recurring event is edited.
Support local timezone handling and daylight-saving transitions.
Allow a simple agenda view to show what is happening today and tomorrow.
Where practical, design the system so calendar import or external calendar synchronisation can be added later. Do not make an external calendar service mandatory.
8. MODULE TWO — TO-DO LIST AND HOUSEHOLD TASKS
Build a flexible task manager.
Each task should support:

* Title.
* Description.
* Assigned person.
* Shared or personal status.
* Priority.
* Due date.
* Optional start date.
* Category.
* Completion status.
* Created and completed timestamps.
* Optional notes.
* Recurrence.
* Optional link to a calendar event or household project.

Include:

* Inbox for quick capture.
* Today.
* Upcoming.
* Overdue.
* Assigned to me.
* Assigned to the other person.
* Shared tasks.
* Completed tasks.
* Custom lists.
* Search and filtering.

Examples:

* Book a dentist appointment.
* Clean the bathroom.
* Arrange an appliance repair.
* Buy a replacement light bulb.
* Research a holiday.
* Organise important documents.

Recurring tasks must generate the next occurrence reliably.
Prevent duplicate recurring tasks if the application restarts or a completion action is retried.
For tasks with a due date, make overdue items clear without turning the entire interface red.
9. MODULE THREE — SHOPPING LISTS
This is one of the most frequently used features, so make it exceptionally fast.
Support:

* A shared supermarket list.
* Separate hardware, household, toiletries and other lists.
* Quick item entry.
* Quantities and units.
* Optional brand.
* Optional notes.
* Optional estimated price.
* Categories.
* Assigned shopper, if desired.
* Completion by tapping an item.
* Recently purchased items.
* Frequently purchased items.
* Restore a mistakenly completed item.
* Clear completed items.
* Purchase history where useful.

The list must update consistently when accessed from multiple devices.
If practical, allow a previously purchased item to be added again with one tap.
Provide a compact phone shopping mode with large checkboxes and minimal navigation.
Support adding ingredients from a recipe without creating duplicate entries unnecessarily. Do not silently merge distinct items with different quantities or notes.
10. MODULE FOUR — TV SERIES AND FILM TRACKER
This is a core feature, not an optional afterthought.
The goal is to track what we are watching, what we have watched and exactly where we got up to.
Television series
Support:

* Search for a series.
* Add a series manually if metadata cannot be found.
* Series title.
* Poster or artwork when available.
* Description and release information where available.
* Status: want to watch, watching, paused, completed, abandoned.
* Seasons and episodes.
* Episode numbers and titles.
* Episode watched status.
* Viewing date, where desired.
* Shared viewing history.
* Individual viewing history.
* Watch-next queue.
* Search and filtering.
* Progress indicators.
* Ratings and notes, optionally.

Episode behaviour
Users must be able to:

* Mark an episode as watched.
* Undo the action.
* Mark an entire season watched.
* Correct an incorrectly recorded episode.
* Resume from the next unwatched episode.
* See the next episode clearly.
* Review past episodes without accidentally marking anything watched.

Track individual viewing history separately from shared viewing history.
Do not assume that because one person watched an episode, both have watched it.
A shared watching-together workflow should be available.
Do not automatically mark skipped episodes as watched unless explicitly requested.
Do not expose spoilers by automatically displaying future episode descriptions.
Films
Support:

* Films to watch.
* Films already watched.
* Watch dates.
* Optional ratings.
* Notes.
* Search.
* Artwork.
* Optional distinction between watched together and watched individually.

Metadata integration
Investigate suitable TV and film metadata sources, such as TMDB, and confirm their current API requirements, attribution rules, image usage rules and key requirements before implementation.
Metadata lookup must be optional.
Manual entry must always remain possible.
Do not scrape websites where a supported API is available.
Do not embed a secret API key in frontend code. If a key is needed, use a backend integration and configuration variables.
If external metadata is unavailable, the tracker must still function.
Design the module so it can eventually import or synchronise viewing information with another service, without making that a requirement for the first version.
11. MODULE FIVE — MEAL PLANNER AND RECIPES
Build a weekly meal planner.
Support:

* Seven-day meal plan.
* Breakfast, lunch and dinner, where desired.
* Saved recipes.
* Recipe ingredients.
* Quantities and units.
* Preparation instructions.
* Preparation and cooking times.
* Serving sizes.
* Recipe categories.
* Dietary tags.
* Favourite meals.
* Meal history.
* A “What should we eat?” suggestion from saved recipes.

Allow ingredients from selected meals to be added to the shopping list.
Where ingredient matching is uncertain, show a review step instead of silently merging items.
Support adjusting recipe serving quantities, with sensible scaling of ingredient amounts.
Do not require internet access to view saved recipes.
12. MODULE SIX — NOTES, IDEAS AND SHARED MEMORY
Build a lightweight household noticeboard.
Support:

* Quick notes.
* Pinned notes.
* Shopping and purchase ideas.
* Future home projects.
* Holiday ideas.
* Restaurants and places to try.
* Gift ideas.
* Things to discuss.
* Useful household information.
* Notes linked to tasks, events or purchases.
* Personal and shared visibility.
* Search, categories and archiving.

Provide a frictionless quick-add function.
Avoid turning this module into an unnecessarily complex document editor.
13. MODULE SEVEN — HOME MAINTENANCE
Track the practical work needed to maintain a home.
Support:

* Maintenance item.
* Description.
* Location in the home.
* Appliance or asset association.
* Last completed date.
* Next due date.
* Recurring schedule.
* Service provider.
* Cost.
* Notes.
* Photos or document references if practical.
* Maintenance history.

Examples:

* Replace water filters.
* Service appliances.
* Check smoke alarms.
* Clean ventilation filters.
* Arrange repairs.
* Track garden or plant care.
* Record paint colours and repair details.

Completing a maintenance job should update its history and schedule the next reminder when appropriate.
14. MODULE EIGHT — HOUSEHOLD INVENTORY
Build a simple searchable inventory.
Track:

* Item name.
* Category.
* Location.
* Brand and model.
* Serial number, optionally.
* Purchase date.
* Purchase price.
* Warranty expiry.
* Manual or receipt attachment reference.
* Notes.
* Optional photo.

Provide quick search and useful categories.
Avoid collecting sensitive information unnecessarily.
Do not store payment card details or account passwords.
If attachments are implemented, validate uploaded file types and sizes and store them safely.
15. MODULE NINE — BILLS AND SUBSCRIPTIONS
Build a household financial reminder system, not a full accounting application.
Support:

* Bill or subscription name.
* Provider.
* Amount.
* Frequency.
* Due date.
* Renewal date.
* Responsible person.
* Payment status.
* Notes.
* Reminder schedule.
* Historical amounts where useful.

Examples include electricity, internet, insurance and streaming subscriptions.
Support recurring due dates and renewal reminders.
Clearly distinguish estimated amounts from confirmed amounts.
Do not claim that a bill has been paid unless the user records that status.
Do not integrate banking or payments in the initial release.
16. MODULE TEN — FUTURE PLANS AND PURCHASES
Create a place for ideas that are not yet immediate tasks.
Support:

* Items we want to buy.
* Home upgrades.
* Holiday ideas.
* Experiences to try.
* Longer-term goals.
* Optional estimated cost.
* Priority.
* Links.
* Notes.
* Status: idea, researching, planned, purchased, completed or abandoned.

Allow an idea to become a task or shopping-list item without re-entering all its information.
Keep this section separate from the immediate shopping list so speculative purchases do not clutter grocery shopping.
17. MODULE ELEVEN — WEATHER AND DAILY INFORMATION
Create an optional information panel for:

* Current weather.
* Forecast.
* Today's events.
* Upcoming reminders.
* Useful household notifications.

Weather must be implemented through a suitable supported source.
Do not invent weather data or pretend a disconnected integration is working.
The rest of Home Hub must remain functional if the weather service is unavailable.
Use caching, sensible refresh intervals and graceful failure handling.
Do not make unnecessary requests to external services.
18. MODULE TWELVE — SMART HOME INTEGRATION
Keep smart-home functionality modular.
Home Assistant may be integrated later to provide:

* Light control.
* Heating information.
* Sensor readings.
* Energy information.
* Robot vacuum controls.
* Other useful home automation.

Do not require Home Assistant to run the core application.
Do not assume the user owns particular smart devices.
Do not implement controls for devices that have not been configured.
If an integration is disconnected, display that state honestly and preserve the rest of the application.
19. MODULE THIRTEEN — QUICK-ADD AND FUTURE VOICE CONTROL
Implement a universal quick-add action.
The user should be able to open a simple input and create a task, shopping item, note or idea with minimal effort.
Where practical, support natural-language shortcuts such as:

* “Buy oat milk.”
* “Remind me to book the dentist on Monday.”
* “Add pasta to next week's meal plan.”
* “We watched episode 5.”
* “Service the filter in three months.”

For the first version, it is acceptable to use simple deterministic parsing and explicit forms.
Do not introduce an LLM API or paid voice service as a mandatory dependency.
Voice input is a later enhancement. Design the application so a voice interface can call the same application logic and API as the normal UI.
20. CROSS-MODULE INTEGRATION
This is essential.
Implement proper relationships between modules.
Examples:

* A task may be linked to a calendar event.
* A recurring maintenance task may reference an inventory item.
* A recipe may add ingredients to a shopping list.
* A meal plan may link to recipes.
* A purchase idea may become a shopping item.
* A bill may generate a recurring reminder.
* A TV series may contain seasons and episodes.
* Viewing progress must be stored per user and, separately, for shared viewing.
* A household project may contain tasks, notes, dates and purchases.

Avoid duplicating information unnecessarily.
Use stable record IDs and database relationships rather than linking records only by display names.
When an item is deleted, apply appropriate referential integrity rules. Avoid deleting historical records accidentally.
21. SEARCH, NOTIFICATIONS AND HISTORY
Provide a useful global search across relevant household data.
Search should return appropriately grouped results and open the selected record.
Provide an in-app notification or reminder centre for:

* Upcoming events.
* Overdue tasks.
* Maintenance due.
* Bills and renewals.
* Other explicitly configured reminders.

Do not overwhelm the household with unnecessary notifications.
Support dismissing and reviewing reminders.
Keep useful completion and viewing history.
Allow archived records to be restored where practical.
Do not silently delete records simply because they are old.
22. DATABASE DESIGN
Design a coherent relational schema before building the complete application.
Potential entities include:

* Households.
* Users.
* Memberships.
* Events.
* Recurrence rules.
* Tasks.
* Task occurrences.
* Shopping lists.
* Shopping items.
* Recipes.
* Recipe ingredients.
* Meal plans.
* Notes.
* Projects.
* Purchases.
* Bills.
* Maintenance records.
* Inventory items.
* Media titles.
* Seasons.
* Episodes.
* User viewing history.
* Shared viewing sessions.
* Notifications.
* Application settings.

These are suggestions, not a requirement to create every table regardless of need.
Use proper migrations so the schema can evolve without destroying user data.
Use database constraints for relationships and data integrity.
Plan deletion, archiving and retention behaviour explicitly.
Store completion timestamps and record ownership where useful.
Use transactions when one action affects several records.
Do not store the same underlying fact independently in multiple places if it can be represented through a reliable relationship.
Provide a documented backup and restore procedure. A backup should not simply copy a database file while it is in an unsafe state.
23. OFFLINE OPERATION AND MULTI-DEVICE ACCESS
The Raspberry Pi is the authoritative server and database host.
The touchscreen and phones should access the same data.
Core functions must not depend on third-party servers.
If internet access fails:

* Tasks must still work.
* Shopping lists must still work.
* The calendar must still work.
* Notes must still work.
* TV progress must still work.
* Saved recipes must still work.

Only externally dependent features should become unavailable.
Use reliable handling of simultaneous updates from multiple devices.
Prevent accidental data loss when two people edit related records.
Provide clear errors if the server is unavailable.
Do not create a fragile offline synchronisation system unless it is actually necessary. A local network connection to the Pi is sufficient for the initial implementation.
If you add a service worker or frontend caching, ensure users cannot unknowingly operate against a stale version after deployment.
24. RELIABILITY, SECURITY AND PRIVACY
Implement:

* Input validation.
* Appropriate API error handling.
* Safe database queries.
* Correct output escaping.
* Protection against common web vulnerabilities.
* Sensible request-size limits.
* Secure handling of any authentication credentials.
* Appropriate local-network access controls.
* Secret management through environment variables.
* Database backups.
* Error logging.
* A health-check endpoint.
* Graceful startup and shutdown.
* Recovery after application restarts.

Do not expose unrestricted database access through the frontend.
Do not bind the backend to every network interface without understanding the security implications.
Provide a setup process that allows the household to use the application on a trusted home network without accidentally making it publicly accessible.
Document any security limitations of the initial version.
25. RASPBERRY PI DEPLOYMENT
The application must be practical to run continuously.
Provide:

* A clear installation guide.
* Dependency installation instructions.
* Database initialisation.
* Environment configuration.
* Database migrations.
* Frontend and backend startup instructions.
* Production build instructions.
* Automatic startup after reboot.
* Chromium kiosk configuration.
* Restart and recovery procedures.
* Database backup and restoration instructions.
* An update procedure that preserves user data.
* A way to access application logs.

Prefer a lightweight deployment.
A systemd service or another appropriate process supervisor can keep the backend running.
Configure the graphical session separately so a browser crash does not require the entire Pi to be restarted.
Do not assume the touchscreen is connected directly to a particular Raspberry Pi model.
Do not assume the operating system is Raspberry Pi OS until confirmed.
Provide a normal browser-based development mode as well as the kiosk deployment.
26. TESTING AND QUALITY ASSURANCE
Write automated tests for important application behaviour.
At a minimum, test:

* Creating, editing and deleting tasks.
* Task completion and undo.
* Recurring task scheduling.
* Creating and editing calendar events.
* Recurring calendar events.
* Adding and completing shopping items.
* Recipe ingredient transfer.
* TV series and season creation.
* Episode completion and correction.
* Independent user viewing progress.
* Shared viewing progress.
* Database persistence after restart.
* Data validation.
* Cross-module relationships.
* Database backup and restoration.
* Handling unavailable external integrations.

Test the API and database separately from the interface.
Add end-to-end tests for the most important household workflows where practical.
Check responsive layouts and touch interactions.
Test empty databases and first-run behaviour.
Do not declare the application finished merely because the development server starts.
Fix errors introduced by your changes before moving on.
27. DEVELOPMENT WORKFLOW
Work in explicit, manageable phases.
Phase A — Inspect and plan

* Determine the actual development environment.
* Inspect any existing repository and files.
* Confirm the Raspberry Pi deployment assumptions where possible.
* Produce the application architecture.
* Define the database schema.
* Define API boundaries.
* Define the navigation structure.
* Establish the design system.
* Create a concise implementation roadmap.

Do not spend excessive time on documentation before implementation.
Phase B — Build the foundation

* Set up the repository.
* Configure the frontend and backend.
* Set up TypeScript.
* Implement SQLite and migrations.
* Create the shared household model.
* Implement basic API routes.
* Build the visual shell and navigation.
* Implement persistent settings.
* Add health checks and tests.

At the end of this phase, the application must run and persist data.
Phase C — Build the core modules
Implement in this order:

1. Dashboard.
2. Tasks and recurring jobs.
3. Shopping lists.
4. Calendar.
5. TV and film tracker.

These are the core features. Make each one usable before moving on.
Phase D — Build additional household modules
Implement:

1. Notes and ideas.
2. Meal planner and recipes.
3. Home maintenance.
4. Household inventory.
5. Bills and subscriptions.
6. Global search and notifications.

Phase E — Integrations
Add optional weather and media metadata integrations.
Keep all integrations modular and nonessential to core functionality.
Phase F — Deployment and hardening

* Test production builds.
* Deploy to the Raspberry Pi.
* Configure kiosk mode.
* Test multi-device access.
* Test reboot recovery.
* Test backups and restoration.
* Verify that all implemented features work.

Do not attempt to implement every phase in a single unreviewed code dump.
28. HOW TO WORK WITH ME
I want you to do the actual development, not just give me instructions to develop it myself.
If you have access to my repository and filesystem, inspect them and work directly with the existing project.
If you do not have direct filesystem access, give me complete, executable files and clearly labelled file paths. Do not pretend you have modified my local machine.
When working in an environment with tool access:

* Inspect before editing.
* Make small, coherent changes.
* Run relevant tests.
* Check the resulting code.
* Report actual test results.
* Keep a concise record of changed files.
* Preserve working functionality.

When working through chat:

* Provide complete file contents for new files.
* For edits, identify the exact file and exact change.
* Avoid telling me to manually merge fragments into large files where a complete replacement is safer.
* Give commands in the correct order.
* Make commands compatible with my stated operating system.
* Do not omit configuration or dependency steps required to run the code.

If a command fails, diagnose the actual error rather than generating a completely new project unnecessarily.
Never say “everything is working” without verification.
At the end of each phase, tell me:

1. What was implemented.
2. What files were created or changed.
3. What tests were run and their actual results.
4. How to run the application.
5. What remains incomplete.
6. The next recommended step.

29. SCOPE CONTROL
This project will grow over time.
Do not attempt to make the first release contain every conceivable feature.
The initial usable release must include:

* Dashboard.
* Shared tasks.
* Recurring tasks.
* Shared shopping list.
* Calendar.
* TV and film tracking.
* Persistent database storage.
* Touch-friendly responsive interface.
* Phone access on the home network.
* Basic backup and restore.
* Raspberry Pi deployment instructions.

Build these properly first.
Additional modules should be added through the same architectural patterns.
Avoid premature microservices, unnecessary container orchestration, paid cloud databases, complex event buses or excessive abstraction.
Do not add AI features simply because they sound impressive.
Reliability and ease of use matter more than the number of features.
30. ACCEPTANCE CRITERIA
The first release is not complete until the following are true:

1. The app launches successfully.
2. The dashboard shows real data from the database.
3. Tasks can be created, edited, completed and restored.
4. Recurring tasks schedule correctly.
5. Shopping items can be added and ticked off.
6. Calendar events persist and display correctly.
7. Television series and episodes can be managed.
8. Individual and shared viewing progress remain distinct.
9. Data survives a restart.
10. The interface works on the framed touchscreen and mobile browsers.
11. Multiple devices see consistent data.
12. Core features work without internet access.
13. The app can run on the Raspberry Pi without a paid hosting service.
14. Backup and restoration have been tested.
15. There are no known critical defects in the core workflows.
16. All unfinished features are clearly documented.
17. Deployment and recovery instructions are complete.

31. YOUR FIRST RESPONSE
Start by doing the following:

1. Briefly summarise the proposed architecture and key decisions.
2. Identify only the critical unknowns that could materially change the implementation.
3. If you have repository or filesystem access, inspect the environment before creating or overwriting files.
4. If you do not have access, explain what information you need from me to tailor deployment, but do not block the initial design on hardware details.
5. Produce the proposed project structure and initial database design.
6. Start implementing the foundation and first usable core features.
7. Provide a clear test and run procedure.

Do not respond with only a project plan and stop. After establishing the plan, proceed with the first concrete implementation step available in your environment.
The ultimate goal is a real, reliable, attractive and expandable Home Hub that we can use every day to manage our household from a single framed touchscreen and our phones.
