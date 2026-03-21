
**Deadline**: 13:00 Day 2\. No exceptions (Recommended to stop development by noon).  
**What you submit**: 2-min video \+ GitHub repo \+ pitch deck \+ live link (optional)  
# Group
I need group to learn from. I will not learn anything new if I worked by my own. 
I am not expecting to win nor ti is my goal. I want to learn and take a photo for linkedIn. 
# ToDo
- [ ] Figma Design 



Submit to AI, Don't do a endless research?
however I usually the people do extensive research before traveling. so this is mainly for spontaneous travel!? unless you do want to submit to AI and rely on it.



![[VID_20260207_132150_611.mp4]]
# Purpose 
- Help organize event/activity with one or group of people. 
- Make people organize there travel, activity collecting info on one place. 
- save all travel & activities in one place. Allow easy fetch and plan via AI. 
- Do acitivty that you saw and wanted to do but forgot about it.
- All in one place app (split wise, booking), info place, map, personal, group planing, 
# Where the idea comes from
- I have many Whatsapp groups (for the local, family, school frends, work) with many people that I want to increase my connection with. I wanted to organize an event  but I don't like the part of communicating and dicussing to make it work with compromises. Chossing footaball, whom like it and alternative. It is tough to handle, it is a job by itself.  This require identify Matching:
	- Activity
	- Place
	- Time
- Usually poeple tend to reject and resist the idea to because they are busy, with this app 
- Also for the hackathon, the organizer send multiple time to participents to introduce themselfs on Discord and prepare for the event. I felt, I everyone was using the service with make it easier to classify them and make groups or help in formulating a good answer. 
- [ ] Future work: This idea has the potential to expand to cover more user info for Dating (Find best match based on preference and experiances) and other group/comparny fits.   
![[20260319_105432.mp3]]
- I remembered my time with Germans in Tranas, Sweden. they made excel sheet with places to visit every weekend. It can be done in the app without the need to handle in Excel app. Community event for future planing. Similar to Calendar event view. 
# Logo
Not sue. 
Maybe show a fish scratch image from the tile. 
Every time I make major release to the app, the fish drawing quality gets better. 
abstract -> pencel drawing -> 2D -> with background ...
# Go Fish idea origin
The service name is inspired by a "[Hoyle Card Games 5 (2001) - Go Fish](https://youtu.be/nO0M3LBEciU?si=BDLk4uuYiolM4YSY)" (a popular cards game with children). From the description of the [Go Fish game](https://cardgames.io/gofish/), the term "Asking and fishing" goes as follow 
> The initial player is selected at random. The player can then ask one of the other players for a particular rank. For example, you might ask a player if they have any sixes. You may only ask for ranks that you already have at least one card of. E.g. if you don't have any sixes yourself you can't ask for them. If the player you ask has any sixes, then they must give them to you, and you get another turn and can ask again. If the player doesn't have any sixes then they will tell you to "Go Fish" which means that you will draw one card from the pile on the table. If you get a six, then you show it to the other players and get to play again. If you get anything else you are finished with your turn and the player next to you plays.

From this context. the idea of "Go Fish" is when a user 1 asks another users that  doesn't have time for the planned event, then they will tell user 1 to "Go Fish" which means that user 1 will rely on AI Agent for the planning and got the final saying on the type of the event from the potential activities. 
# Use cases/personas
- If user 1 asked user 2 to go out (or to do activity) on a day, but user 2 is not available due to obligation. Then, User 1/2 send a Go-Fish link to the other to rely on AI-Agent to find a day or handle it. 
- If the user 1 and user 2 are busy and want to setup an event without the ping-pong conversation, they can use the AI-agent to do it.
- If User 1 is in a group with many users , it is complicated to coordinate and takes a lot of texting and back and further to find a matching date and activity. (e.g. organize a football match in a group). Avoid the texting and communication/waiting time. Also, maybe a volleyball would be way much better. How said football was desired in the first place. 
# Nice things that makes the service unique
- If user 1 asked user 2 to go out (or to do activity) on a day, but user 2 is not available due to obligation. Then, User 2 need to send a Go-Fish link to the other user(s) to use his API token for AI-Agent to find a day or handle it.  He was not available so it is his turn to pay for API token. Or instead of API token (as it feels punishment, which is not desired), the  User 1 got the final saying if AI Agent suggusted multiple activities or so. 
# Ideas for service flow.
I want to build a service (for web and mobile) that allow two or more people to organize an activity or an event using AI agent. Each user store his own personal information in service (like memory for the AI), so that AI can rely on to suggest and matching event. 
- Handle everything related to Countries, Activities and travel planning. 
# Data 
Something is clear that the more the user use the service (data collected) over time, the better results it will be. 
- [ ] maybe the AI (at early stages) will ask the users a lot to decide on activity once I go fish request is make. 
## Storage
- I think the best possible way and location to store the user's data is in **Google Drive** (or any user of choice drive) in a known format and structure to allow other AI agent the user is using (such as OpenClaw) to re-use these information and doesn't require the user to re-teach the model with the same information. 2-in-1, The service (Go Fish) and other agent (OpenClaw) can update the data base either manually by user or stored info by Agent. User Skill to know how to deal with the storage DB. For instance, user tells AI where to go in Switzerland, it would suggust to do activity mentioned in the counties' note. 
## what to include User personal information (save vault)
- A user (Andy) suggested to add the food allergy and preferences. as it helps in selecting the restaurant to try and eat (during the events or as meetup point)
	- This is interesting idea as I got asked this question once I signed up for this event (Heilbronn Hackathon) about my food preferences. Maybe, Go Fish link can setup for meal preferences and decide a orders for group of people from different places that works best with everyone without guessing or communicating. AI saves time and this achieves it.  
	- For me personally, I have this information stored on Obsidian Note-taking app, and this would feel taking advantage of it by sharing it with AI Agent to plan on my behalf. 
- The service allows user to give feedback to improve activity. text by direct edit or voice/chat with AI or upload voice memo to AI to parse/process and came up with changes or improvement. (maybe closer to identify another activities that wold fit well). 
	- I feel the travel note after each sleepover to improve on my habit and way to handle event well. 
	- Read note, memory before event beings to remind myself about it to avoid past mistakes and have better experience. TBH, it feels Note-taking with AI. Maybe this will avoid to do later. handle it on the spot. 
## Others
Movies and entertainment (IMDb) to idenfiy categories, new movies (sequal) is released to watch  it together?

## beyound just activity. preference about the activity. 
like a goolkeeper in football. it help in organzie the turnments and set each one a team and position in the game. Since huge number is hard to handle, AI can make turniment with qualifications. 

# User <-> Service communication
- Using chat/voice to communicate with AI Agent similar to openclaw with skill that understand the DB storage structure. 
- Select places to visit similar to booking apps. 
- It is like chatGPT, when you ask what activities to do in Switzerland, it can look up the note and give suggusion based on previous note.
	- Maybe a auto search for potential popular event in the country note and sugusst any . 
## Service Data 
### activities
- Each statet in germany provide a list of activieis and sports facilities that I can look up and link. Football stadium, tennis, mini-golf, 
### countries
List of all countries.
- Allow user to save a text note (the location of the activity, country note) from any social media source or recommendation instead of saving media to the void and forget about it. 
	- Huge number of reels/shorts/social media content is about either travel (visit counties) or acitivty (turist, restaurent//food, and sports etc.). 
	- I think it will help people handle this content better with no feeling of adding additional work. 
	- [ ] Future work. Make the service accept Link of the social media or place/activity, it will handle to parse it to identify it correctly and sort it in the memory for things to consider next time. If the AI handle it correctly, prompt the user for review and take confirmation to store what what (maybe just few things and not everything to add).

# MVP
simple enough to show a demo. 
## Limitation (future work)
- I will not list all the existing activities. Stay small to test the app usability. Thus, I will list the basicis or popular activities such as Football,  etc.
- Is it easy to show MAP with pin for the event? Maybe on or two. 
	- Show TimeLine of a sequence of events. 

## Challenges (Need alternative plan for)
- Calendar: Not all people use it and might not work as planned if user didn't maintained it.  As much as I hope to give people additional reason to use calendar, I can ship a product that's not suitable to my audiance. To make booking. 
- The users at the early stage, have no data stored and doesn't feel useful to start using directly. Need time to be useful. How to  do it? make a startup survy for the user to fill it in like fitness app? What questions to asks. 
- What if the one of the persons is lazy to use the service, how to make hard to ignore? use google sigin-ion only and the AI handle the rest? 
- How to convence privacy focus people to use? do I need them? how would be perfect fit for this service. 
- events collide or not matching event found? I want to eat Chinese but other user don't want it? 

# Questions:
- [ ] Who is my target users? senior, teenanger? 30-40 age range? working class? employees. 
- [ ] What is the estimated market size?
- [ ] How are you planning to make a profit?
- [ ] typical question or expected question that Dragon dan asks any entrepreneur after pitch, 
- [ ] Is the idea salable or not? 
- [ ] Is it feasible idea or not?
- [ ] is it a good idea or not?
- [ ] will people use it or not?
- [ ] Whom are my compactors and already existing similar services. 
- [ ] what people I am solving for ppl?

# User Feedback
Collect more data from different users.
- [ ] I need a survay to know my audience and if it is usable or what to modify. 
## Andy WG, 43 Male sport teacher for primary school in Germany.
- I don't need an AI app to do it, usually we handle it 1:1 a phone call. 
- none of them use nor update the calendar app. 
- Not exited about split-wise to split the moeny, there are already many app to handle it and each one pay on the spot or at checkout. Events of 2 users usually each one pay for himself. 
- He doesn't see the point to outsource everything to AI, he want to use his mind. 
## Khaled bro, 33M 

## Ibrahim friend, 32M 

## Fatmeh sis, 34 F

## Baba, 72 M, 

## MAMA, 66 F, 

# PowerPoint Slides (**Pitch deck**)
timeline ideas
- show a line on the side or the bottom of the slides that has pins or each milestones to complete the project. e.g. pin log done, survey, etc. I shows how I progress in the project.
- The pins appears based on the slides title. and progress to show all the stages of the project until completion. 


**What to Put in Your Slides (max 5\)**

Goal: Prove this could become a real business. 

*this is for inspiration only, you could structure your slides as you wish. just remember, if you get to the finals you will have 2 mins to do the pitch, 2 mins for your demo and 2 mins for Q\&A.* 

**Slide 1: The Market Problem**

* who has this problem? (be specific: "B2B sales teams," not "businesses")  
* how big is this market? (\# of companies, users, spend)  
* how do they solve it today and why does that suck?

(Investors fund markets, not features.) 

**Slide 2: Your Solution**

* what you built in one sentence  
* why is your approach 10x better than alternatives?

(Keep it short. Just enough to understand what it does.) 

**Slide 3: Business Model**

* who pays?  
* how much would they pay?  
* what's the unit economics? (e.g., $50/mo subscription, costs $5 to serve)

(Show you've thought about how money works.) 

**Slide 4: Go-to-Market Plan**

* how would you get your first 10 customers? (be specific: "DM 50 founders in YC W25 batch")  
* what's your distribution advantage? (existing audience? community? partner?)

what would make someone switch from their current solution? (This is the hardest part. Show you have a real plan, not "post on social media.") 

**Slide 5: Why You / Why Now**

* why are you the right team to build this?  
* would you work on this full-time if it got traction?

(Judges invest in founders who won't quit.)

# Compatatietors.
I am not competing with travel agency or tripadvisor. No review nor just list people's top visited places. I want to create personalized experiance. Specially when it comes to group planning as Solor doesn't happened that often.  
# State of the art
 - State of the art

# Make money
When the time comes, there will be many way to earn money. 
- I will make money from the 0.99Euro lifetime one-time fee for using the full- feature of the app. 
- Users like?! open source project, have access /control to there data, and self-hosted possible and using personal API etc. 
[00:00 - 02:28]
![[20260319_104603.mp3]]
# Design and service usage
[02:29-03:02]
Figma design
Search on Home (once open the app)
Bottom (navigration bar): goto DB, countries, Activity, etc. 
- Maybe need location permission to find user location and answer prompt request correct. 

- From link "Go Fish". The AI Agent, keeps listening to users joins the link. 



# Prompt planning 
- **Ideas, notes, sketches, research** — come prepared with your concept and planning materials  
* **Generic starter templates** — boilerplate you reuse for any project (not project-specific)  
* **Third-party tools, open source, sponsor tech** — use any tools and libraries (respect licenses)
* **Commit early, commit often** — use git throughout the weekend, create your repo at kickoff  
* **Ship a working demo slice early** — get something functional first, then improve. Stability wins.
# Final results 
Projects will be judged on: 

1. Market potential and product viability: How well do you understand your users?  
2. Technical innovation  
3. Execution & working demo  
4. UX & Design  
5. Presentation



![[Cursor Community Hackathon Heilbronn.png|584]]



## **7\. Two-Day Battle Plan**

Here is a blueprint for the pace you need to have to finish in time.

### **Phase Timeline**

**DAY 1**

| Milestone | Timeline | Description |
| :---- | :---- | :---- |
| Idea | 11:00 to 13:00 | Decide what you're building |
| Setup | 13:00 to 14:00 | Repo, starter template, API keys |
| MVP | End of day | One core feature working end-to-end |

**DAY 2**

| Milestone | Timeline | Description |
| :---- | :---- | :---- |
| V1 | 11:00 | Stop building, start preparing submission |
| Demo | 11:30 to 12:30  | Record video, write pitch, practice |
| **SUBMIT**  | 13:00 | Hard deadline at 13:00, no exceptions |

## **8\. Submission Guide** {#8.-submission-guide}

### **Required Accounts**

Create these before the event:

1. **GitHub** — source code submission   
2. **YouTube/Loom** — video demo upload

### **What You Submit**

Submit at hackathon portal:

* 2-minute video (YouTube or other service link)  
* Source code on GitHub (repo)  
* Pitch deck (url)  
* Working demo (url) \- optional but encouraged

**Important**: all of them have to be publicly accessible when submitting. 
### **How You're Evaluated**

We judge your project like investors judge a startup: not just "does it work?" but "could this fly?" Ship something real. The further you get on the startup journey during the hackathon, the more points you earn.

| Weight | Category | What We Look For |
| :---- | :---- | :---- |
| 25% | **Product Viability & Market Potential** | Could this become a real product or company? Clear problem for real users? |
| 25% | **Technical Innovation & AI Implementation** | Creative use of AI? Strong sponsor tool integration? Novel approach? |
| 20% | **Execution & Working Demo** | Does it actually work? How complete? Stable during the demo? |
| 15% | **User Experience & Design** | Intuitive interface? Good user flow? Visually polished? |
| 15% | **Presentation** | Clear problem story? Engaging video? Well-structured pitch? |

# Tools
⸻

**Design & UI prototyping**

**v0** A tool for generating and iterating on web app UI quickly from prompts, helping teams move from idea to a usable interface fast. Learn more: [v0.app](https://v0.app)

⸻

**AI model APIs (core product intelligence)**

**Google Gemini API** An API for adding AI capabilities to your app (like understanding, writing, and multimodal features depending on the model). Learn more: [ai.google.dev/gemini-api/docs](https://ai.google.dev/gemini-api/docs)

**Featherless** Featherless AI is a serverless AI inference platform and research lab that lets you run large language models and other open‑weight models via API without managing your own GPU infrastructure.

⸻

**Backend**

**Convex:** Convex (convex.dev) is a backend-as-a-service and database platform designed to let you build full-stack apps without managing your own backend or database infrastructure.

⸻

**Team collaboration & planning**

**Miro** A visual collaboration board for teams to brainstorm ideas, map user flows, sketch quick diagrams, and keep everyone aligned while you build. Useful for early ideation and for making your demo story clear. Learn more: [miro.com](https://miro.com/)

⸻

**Building (coding / IDE)**

**Cursor** An AI-powered code editor that helps you write and edit code faster (generate code from instructions, refactor, debug, and iterate quickly). Learn more: [cursor.com](https://cursor.com)

**Antigravity** An AI-assisted development environment that uses agents to help you build software as part of your coding workflow. Learn more: [antigravity.google](https://antigravity.google/)

⸻

**Automation & “make it do stuff”**

**n8n** A workflow automation tool that connects apps and services, so you can build flows like “when X happens → do Y → notify Z” without wiring everything manually. Learn more: [n8n.io](https://n8n.io/)

**LangChain** A toolkit for building AI apps that run multi-step workflows, connect models to tools/data, and implement patterns like retrieval (RAG). Learn more: [langchain.com](https://langchain.com/)

⸻

**Voice & audio**

**ElevenLabs** Tools and APIs for generating voice/audio (for example, turning text into speech and building voice experiences). Learn more: [elevenlabs.io](https://elevenlabs.io/)

⸻

