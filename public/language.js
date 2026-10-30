// Display-language copy only: never translate persisted work, enum values or file names.
(() => {
  const copy = {
    'Next-step overrides were removed. Use the stage owner settings or Discussion.':
      '下一步备注和负责人覆盖功能已移除，请使用阶段负责人设置或 Discussion。',
    'The task action changed. Reopen the task and try again.':
      '任务的当前行动已改变，请重新打开任务后重试。',
    'Marked as urgent by {name}': '由 {name} 标记为 Urgent',
    'Assign a current action owner before marking this task as urgent.':
      '请先指定当前需要行动的负责人，再标记为 Urgent。',
    'Only the person who marked this task urgent or the task owner can cancel it.':
      '只有最初标记者或任务 Owner 可以取消 Urgent。',
    'Only a current action owner can acknowledge this reminder.':
      '只有当前需要行动的负责人可以确认此提醒。',
    'Reminder acknowledged. The task stays urgent.': '已确认收到提醒，任务仍保持 Urgent。',
    'Urgent cancelled': '已取消 Urgent。',
    'Task marked as urgent': '任务已标记为 Urgent。',
    'Task link copied': '任务链接已复制。',

    'QA passed. Confirm the Production deployment before recording the release.':
      'QA 已通过，请确认 Production 部署后再记录实际发布。',
    'Automatically includes tasks that passed current Stage QA by {end}, plus Production deliveries from {start} through {end}. Tasks reserved for future plans stay in those plans. Uncheck and save to exclude.':
      '自动纳入截至 {end} 已通过当前 Stage QA 的任务，以及 {start} 至 {end} 已交付 Production 的任务。已预约到未来计划的任务保持原计划；取消勾选并保存即可排除。',

    'Production deployment is complete. Review the history below.':
      'Production 部署已完成，可以在下方查看历史。',
    'The due date follows the current stage: entering QA gives QA seven days from Engineering delivery; passing QA gives Production seven days from the QA work date. Confirming Production deployment completes the task.':
      '截止日期随阶段变化：进入 QA 后，从 Engineering 交付工作日计算七天；QA 通过后，从 QA 工作日计算 Production 的七天期限。确认 Production 部署即完成任务。',
    'You can record work on a task assigned to another engineer. Keep the Assignee unchanged. Confirm deployed & complete after verifying the Production deployment; no separate completion check is needed.':
      '可以记录分配给其他 Engineer 的任务工作，Assignee 保持不变。验证 Production 部署后点击 Confirm deployed & complete，无需再单独确认完成。',
    'Complete the task after verifying the Production deployment, and include it in the pending version update.':
      '验证 Production 部署后完成任务，并将其纳入待发布版本。',

    'Choose a QA result or use Need Explanation.':
      '请选择 QA 结果，或点击 Need Explanation 先讨论。',
    'Describe what did not pass and what needs to change':
      '请说明哪些内容没有通过，以及需要怎样修改。',
    'Write your question and post it to the engineer. QA stays open.':
      '填写问题后发给 Engineer，QA 会保持进行中。',
    'Choose Passed, Partially Passed or Not Passed. Details are optional for Passed; describe the issues for the other two results.':
      '选择 Passed、Partially Passed 或 Not Passed。Passed 的说明选填；另外两项需要说明问题。',
    'Use Need Explanation to discuss a question with the engineer before choosing a result. Posting a discussion does not finish QA or return the task to development.':
      '可以先点击 Need Explanation 与 Engineer 讨论，再决定测试结果。发送讨论不会结束 QA，也不会把任务退回开发。',
    'Record a QA result': '记录 QA 结果',
    'Use Next Step to confirm Engineering or QA work. QA offers Passed, Partially Passed and Not Passed; use Need Explanation to discuss questions first.':
      '使用 Next Step 确认 Engineering 或 QA 工作。QA 结果有 Passed、Partially Passed 和 Not Passed；需要先交流时点击 Need Explanation。',
    'Open Task settings for owners and planning, Activity timeline for history, or Discussion to exchange details.':
      'Task settings 管理负责人和计划；Activity timeline 查看历史；Discussion 用于交流细节。',

    'Activity type and task stage': '工作记录类型与任务阶段',
    'Use Activity type in Record other work to describe work you did. Development work records an activity; it does not move the task to Development.':
      'Record other work 中的 Activity type 用来说明已做的工作。选择 Development work 只记录一条 Activity，不会把任务移到 Development 阶段。',
    'Use Next Step to confirm a workflow change. Category is the product area, Type is the kind of request, and Planning status says whether the work is queued or active.':
      '通过 Next Step 确认流程变化。Category 表示业务模块，Type 表示需求类型，Planning status 表示待安排或正在推进。',

    'In New task, add images or files before clicking Create task. Click the Attachments area, then paste with ⌘V / Ctrl+V, or click Choose files. Remove a selected file with ×. If an upload fails, click Retry uploads.':
      '在 New task 中，点击 Create task 前可以添加附件：先点击 Attachments 区域，再按 ⌘V / Ctrl+V 粘贴，或点击 Choose files 选择文件。点击 × 移除文件；上传失败时点击 Retry uploads 重试。',
    'Open My account by clicking your avatar or the account icon. Click the upload area, then paste with ⌘V / Ctrl+V, or click Choose files. Your photo appears beside your name in the workspace.':
      '点击头像或账户图标打开 My account。点击上传区域后按 ⌘V / Ctrl+V 粘贴照片，或点击 Choose files 选择。照片会显示在工作区的姓名旁边。',

    'Click here, then press ⌘V / Ctrl+V to paste an image': '点击此处，再按 ⌘V / Ctrl+V 粘贴图片',
    'Ready — press ⌘V / Ctrl+V to paste an image here': '已定位 — 按 ⌘V / Ctrl+V 将图片粘贴到这里',
    'Or drop images or files here': '也可以将图片或文件拖到这里',
    'Choose files': 'Choose files',
    'Click the dashed attachment area to focus it. A blue outline means it is ready; press ⌘V / Ctrl+V to paste an image there. Choose files opens the file picker.':
      '点击虚线附件区域进行定位，出现蓝色边框后按 ⌘V / Ctrl+V，即可将图片粘贴到这里。点击 Choose files 可选择文件。',
    'Add attachments': '添加附件',

    'Open task in a new tab': '在新标签页打开任务',
    'Save your changes before opening another view.': '请先保存修改，再打开另一个视图。',
    'Use Open in new tab in the task header for a full page. Save any changes first; the new tab opens the saved task.':
      '点击任务顶部的 Open in new tab，在新标签页完整查看。请先保存修改，新标签页显示已保存的任务。',
    'Use Back to board to return. Task actions and permissions stay the same.':
      '点击 Back to board 返回看板，任务操作和权限保持一致。',

    'Confirmed this stage by mistake? Preview the undo before restoring it.':
      '误点了这次阶段确认？可以先预览撤销内容，再决定是否恢复。',
    'To correct a mistaken confirmation, use Undo this stage change in the matching Previous stage card. If the latest update is not shown there, open Task settings → Stage change history → Undo last stage change. Review the values and enter a reason; history remains. For failed QA, record the QA result in Next Step.':
      '需要纠正误点确认时，在对应的 Previous stage 卡片点击 Undo this stage change；如果最新更新没有显示在这里，可到 Task settings → Stage change history 找 Undo last stage change。核对恢复内容并填写原因，历史仍会保留。QA 不通过时，请在 Next Step 记录 QA 结果。',
    'To correct a mistaken confirmation, click Undo this stage change in its Previous stage card. Review Changes to restore before confirming.':
      '需要纠正误点确认时，点击对应 Previous stage 卡片里的 Undo this stage change，确认前先核对 Changes to restore。',
    'Enter why it was a mistake, then confirm Undo this change. If the latest update is not shown in Previous stage, find Undo last stage change in Task settings → Stage change history. Activity history is kept.':
      '填写误操作原因，再确认 Undo this change。若最新更新未显示在 Previous stage，可到 Task settings → Stage change history 找 Undo last stage change；Activity 历史会保留。',

    'Changes to restore': '将恢复的内容',
    'Correct a mistaken stage change': '纠正阶段误操作',
    'Use this only if you confirmed the wrong stage. Review what will be restored before continuing.':
      '仅用于误点阶段确认。继续前，请先核对下面将恢复的内容。',
    'This changes the Work Tracker record only. It does not undo code merges or deployments. For failed QA, record the QA result in Next Step.':
      '此操作只恢复 Work Tracker 内的记录，不会撤销真实的代码 merge 或部署。QA 测试不通过，请在 Next Step 记录 QA 结果。',
    'The latest stage update will be restored to its previous saved values.':
      '最近一次阶段更新将恢复为更新前保存的值。',
    'Correct a mistaken confirmation by restoring the saved values below. Activity history is kept.':
      '通过恢复以下已保存的值纠正误点确认，原有 Activity 历史会保留。',
    'Why was this stage change a mistake?': '为什么需要纠正这次阶段变更？',
    'e.g. I clicked the wrong stage.': '例如：我误点了错误的阶段。',
    'This stage change is no longer available to undo. Reopen the task.':
      '这次阶段变更已无法撤销，请重新打开任务查看最新状态。',
    'In Task settings → Stage change history, use Undo last stage change only to correct the latest mistaken confirmation. Review the values to restore and enter a reason; history remains. For failed QA, record the QA result in Next Step.':
      '在 Task settings → Stage change history 中，使用 Undo last stage change 纠正最近一次误点确认；核对将恢复的内容并填写原因，历史仍会保留。QA 不通过时，请在 Next Step 记录 QA 结果。',
    'To correct a mistaken stage confirmation, open Task settings → Stage change history → Undo last stage change.':
      '需要纠正阶段误操作时，打开 Task settings → Stage change history → Undo last stage change。',
    'Read Changes to restore, enter why it was a mistake, and confirm Undo this change. The original activity remains in history.':
      '查看 Changes to restore，填写误操作原因，再确认 Undo this change；原有 Activity 仍保留在历史中。',
    'Only the Work Tracker record is restored. Code merges and deployments are unchanged. Use Next Step to record a failed QA result.':
      '只恢复 Work Tracker 内的记录，真实的代码 merge 和部署不会被撤销。QA 测试不通过，请在 Next Step 记录 QA 结果。',

    'Choose Feasibility for requests awaiting assessment, Development for development and fixes, or PR & Stage for PR review and Stage deployment. Only the selected tab shows its count.':
      '选择 Feasibility 查看等待需求评估的任务，Development 查看开发与修改中的任务，PR & Stage 查看 PR review 与 Stage 部署任务；只有当前选中的 tab 显示数量。',
    'Use Cards / List at the top to switch the layout. Choose Feasibility, Development, PR & Stage, Ready for QA or Production to focus on one workflow step; choose All tasks to show every stage. Open Filters for category, development, QA progress and sorting.':
      '在顶部使用 Cards / List 切换布局。选择 Feasibility、Development、PR & Stage、Ready for QA 或 Production 聚焦对应步骤；选择 All tasks 查看全部阶段。Filters 可以继续筛选分类、开发状态和 QA 进度并设置排序。',

    'Choose Review feasibility for requests awaiting assessment, In progress for development and fixes, or PR review / Stage for PR review and Stage deployment. Only the selected tab shows its count.':
      '选择 Review feasibility 查看等待需求评估的任务，In progress 查看开发与修改中的任务，PR review / Stage 查看 PR review 与 Stage 部署任务；只有当前选中的 tab 显示数量。',
    'Use Cards / List at the top to switch the layout. Choose Review feasibility, In progress, PR review / Stage, Ready for QA or Production to focus on one workflow step; choose All tasks to show every stage. Open Filters for category, development, QA progress and sorting.':
      '在顶部使用 Cards / List 切换布局。选择 Review feasibility、In progress、PR review / Stage、Ready for QA 或 Production 聚焦对应步骤；选择 All tasks 查看全部阶段。Filters 可以继续筛选分类、开发状态和 QA 进度并设置排序。',

    'Focus on the work you need': '聚焦当前需要处理的工作',
    'Choose Review feasibility for requests awaiting assessment, In progress for development and fixes, or PR review for submitted PRs. Deploy to Stage, Ready for QA and Production keep later steps separate.':
      '选择 Review feasibility 查看等待需求评估的任务，In progress 查看开发与修改中的任务，PR review 查看已提交等待 review 的 PR；后续步骤分别显示在 Deploy to Stage、Ready for QA 和 Production。',
    'Choose All, Needs my action or Unassigned beside the stage tabs. Needs my action includes your current steps and shared PR review/deployment steps.':
      '在阶段 tabs 旁选择 All、Needs my action 或 Unassigned。Needs my action 包含当前由你负责的步骤，以及共同负责的 PR review 和部署步骤。',
    'Use All or Unassigned beside the stage tabs to review task ownership. Viewing does not assign a task.':
      '在阶段 tabs 旁选择 All 或 Unassigned 查看负责人；查看不会改变任务分配。',
    'Daily Engineering Activity is collapsed initially. Click its heading to load the daily records; change Work date inside to review another day.':
      'Daily Engineering Activity 默认折叠；点击标题后加载当天记录，在里面修改 Work date 可以查看其他日期。',
    'Use Cards / List at the top to switch the layout. Choose Review feasibility, In progress, PR review, Deploy to Stage, Ready for QA or Production to focus on one workflow step; choose All tasks to show every stage. Open Filters for category, development, QA progress and sorting.':
      '在顶部使用 Cards / List 切换布局。选择 Review feasibility、In progress、PR review、Deploy to Stage、Ready for QA 或 Production 聚焦对应步骤；选择 All tasks 查看全部阶段。Filters 可以按分类、开发状态、QA 进度和排序继续筛选。',

    'Quick guide': '简短指南',
    'Read full guide': '查看完整指南',
    'What changed': '本次更新',
    'Guides are grouped by page. Open a section to read it again; one confirmation covers that page.':
      '指南按页面合并，展开即可重读；每个页面只需确认一次。',
    'PR Submitted → choose PR reviewer → Confirm reviewed & merged → deploy to Stage → choose QA. The engineer owner can record the review on behalf of the reviewer.':
      'PR Submitted 后选择 PR reviewer，确认 review 与 merge，再部署到 Stage 并选择 QA；engineer owner 可以代 reviewer 记录。',
    'Click Reply below QA feedback to discuss it with Engineering or QA. Replies keep the original QA result unchanged.':
      '点击 QA 反馈下方的 Reply 与 Engineering 或 QA 讨论；回复不会更改原来的 QA 结果。',
    'Backlog may have no Assignee. Expand its separate Board section, then choose Primary Owner in Task settings when activating it.':
      'Backlog 可以不分配 Assignee，在 Board 中单独展开。准备开始时，在 Task settings 选择 Primary Owner 并改成 Active。',

    'Recorded by {person}': '由 {person} 记录',
    'Keeping Backlog separate': '单独管理 Backlog',
    'Expand Backlog or Planned below the active tasks to review future work separately.':
      '展开进行中任务下方的 Backlog 或 Planned，可单独查看未来工作。',
    'In + New, choose Backlog and leave Assignee empty to record an idea before assigning an engineer.':
      '在 + New 中选择 Backlog，可先记录想法，将 Assignee 留空，稍后再分配 engineer。',
    'Expand Backlog below the active Board tasks. In Task settings, choose Primary Owner and change Planning status to Active when the work is ready to begin.':
      '展开 Board 进行中任务下方的 Backlog。准备开始时，在 Task settings 选择 Primary Owner，并将 Planning status 改成 Active。',
    'PR review and Stage deployment': 'PR review 与 Stage 部署',
    'PR review and merge are separate from deploying to Stage. QA starts only after the Stage handoff is confirmed.':
      'PR review/merge 和部署到 Stage 分开处理。确认交付到 Stage 后，QA 才开始测试。',
    'Confirm PR Submitted in Next Step. Then choose PR reviewer and click Assign reviewer; the reviewer and engineer owner share this task.':
      '在 Next Step 确认 PR Submitted 后，选择 PR reviewer 并点击 Assign reviewer；reviewer 和 engineer owner 共同负责这一步。',
    'After the PR is reviewed and merged, click Confirm reviewed & merged. The engineer owner or another Engineering task owner can record it on behalf of a reviewer who does not use this workspace.':
      '完成 PR review 并 merge 后，点击 Confirm reviewed & merged。Reviewer 不使用此工作区时，engineer owner 或其他 Engineering task owner 可以代为记录。',
    'Deploy the merged build to Stage. In Next Step, choose QA owner and click Confirm deployed to Stage → QA only when the build is ready to test.':
      '将已 merge 的构建部署到 Stage。在 Next Step 选择 QA owner，确认可以测试后，再点击 Confirm deployed to Stage → QA。',
    'The owner or another Engineering task owner may confirm on behalf of the reviewer. The reviewer and the person recording the result are both retained.':
      'Owner 或其他 Engineering task owner 可以代 reviewer 确认；系统同时保留 reviewer 和实际记录人。',
    'The engineer owner or reviewer can confirm the deployment. QA starts only after this build is available on Stage.':
      'Engineer owner 或 reviewer 都可以确认部署。构建实际部署到 Stage 后，QA 才开始测试。',
    'Choose the PR reviewer, then confirm review and merge. The engineer owner or another Engineering task owner can record this on behalf of the reviewer.':
      '选择 PR reviewer，再确认 review 和 merge。Engineer owner 或其他 Engineering task owner 可以代 reviewer 记录。',
    'PR review and merge are complete. Deploy the merged build to Stage, verify it is ready to test, then select QA and confirm the handoff.':
      'PR review 和 merge 已完成。将构建部署到 Stage 并确认可以测试后，选择 QA 并确认交付。',
    'Confirm PR review and merge before deploying to Stage':
      '请先确认 PR review 和 merge，再部署到 Stage。',
    'Assign {reviewer} to review this PR.': '将此 PR 交给 {reviewer} review。',
    'Confirm that {reviewer} reviewed and merged this PR. You are recording this confirmation; Stage deployment is the next step.':
      '确认 {reviewer} 已 review 并 merge 此 PR。此次确认由你记录，接下来部署到 Stage。',
    'Keep ideas here without assigning an engineer. Activate when the request is ready for review.':
      '这里可以保存尚未分配 engineer 的想法；准备进入需求 review 时，再改成 Active。',
    'Planned work stays separate until it becomes Active.':
      'Planned 工作单独展示，开始工作时再改成 Active。',

    'Discussing QA feedback': '讨论 QA 反馈',
    'Read replies below Previous stage · QA or in Discussion. The replies stay linked to the QA feedback.':
      '在 Previous stage · QA 下方或 Discussion 查看回复，回复始终关联到对应的 QA 反馈。',
    'Click Reply below Previous stage · QA to answer the feedback directly. Add your explanation or screenshots, then click Post reply.':
      '点击 Previous stage · QA 下方的 Reply，可直接回复反馈。填写说明或添加截图后，点击 Post reply。',
    'Response needed from initially selects the QA author. Change or clear it before posting if a response is not needed. QA can reply in the same discussion.':
      'Response needed from 默认选择提出反馈的 QA。如不需要对方回复，可在发布前更改或清空；QA 也能在同一讨论中继续回复。',
    'Replies appear below the feedback and remain in Discussion. After fixing the issue, expand Next Step to confirm a fresh Stage build and hand it back to QA.':
      '回复会显示在反馈下方，并保留在 Discussion。修复后再展开 Next Step，确认新的 Stage 构建并交回 QA。',
    'Reply to QA feedback from {person}': '回复 {person} 的 QA 反馈',
    'Reply must refer to QA feedback on this task': '回复必须关联当前任务中的 QA 反馈。',
    'Reply must stay with its original QA feedback': '回复必须保留在原来的 QA 反馈讨论中。',

    'Task stage colors': '任务阶段颜色',
    'Look at the task background on Engineering Board and its Next Step card: gray is waiting, blue is PR, yellow is waiting for QA, red needs changes, pale green is Production and stronger green is completed. Keep reading the stage label for the exact status.':
      'Engineering Board 和 Next Step 卡片使用一致的阶段背景：灰色表示等待开始，蓝色表示 PR，黄色表示等待 QA，红色表示需要修改，浅绿色表示 Production，更明显的绿色表示完成。具体状态仍以阶段标签为准。',
    'Read Task description and Task images & files at the top. Expand Next Step below them to see the current action, responsible person and stage controls.':
      '先查看顶部的 Task description 和 Task images & files。展开下方的 Next Step，可查看当前操作、负责人并更新阶段。',
    'Expand Next Step when you are ready to confirm progress, a QA result or delivery. Read Previous stage below it for the last completed result; expand Activity timeline for the full history.':
      '需要确认进度、QA 结果或交付时，再展开 Next Step。下方的 Previous stage 显示上个阶段的完成结果；完整记录可在 Activity timeline 查看。',

    'Reading activity details': '查看活动详情',
    'Today’s activity shows a short preview of each entry. Click an entry to read its full notes and attachments; for Engineering activity, use Open task to continue to its task.':
      'Today’s activity 显示简短预览。点击条目可查看完整内容和附件；Engineering 活动可通过 Open task 继续打开对应任务。',
    'Today’s activity shows your submissions, dated work and feedback. Choose a date on Dashboard to review that day. Daily Work keeps its existing privacy.':
      'Today’s activity 显示任务提交、工作记录和反馈。在 Dashboard 选择日期可查看当天活动；Daily Work 保持原有隐私范围。',
    'Creating tasks and reporting bugs': '创建任务与报告 Bug',
    'Choose a date on Dashboard to read new task submissions and bug reports in Today’s activity. Click an entry to open its task and attachments.':
      '在 Dashboard 选择日期，可在 Today’s activity 查看当天新建的任务和 Bug 报告。点击条目可打开任务及附件。',
    'Use Engineering Board → + New to create a request or report a bug. Choose Bug Fix for a bug report and add the reproduction steps and screenshots.':
      '通过 Engineering Board → + New 新建需求或报告 Bug。报告 Bug 时选择 Bug Fix，并填写复现步骤、添加截图。',
    'After Create task, open Dashboard → Today’s activity to see your submission on the day you created it. PM and Quick Task submissions appear there too.':
      '点击 Create task 后，可在 Dashboard → Today’s activity 看到创建当天的提交记录。新建 PM Task 和 Quick Task 也会显示。',
    'Use Activity for later work. Editing task settings does not add another task creation record.':
      '后续工作通过 Activity 记录。修改任务设置不会重复生成创建记录。',

    'Use Next Step to record QA results': '请通过 Next Step 记录 QA 结果。',
    'Record extra work here without changing the task stage. Use Next Step to confirm Engineering or QA results.':
      '这里仅记录额外工作，不改变任务阶段。Engineering 或 QA 结果请通过 Next Step 确认。',
    'Only edit deadlines for the current stage. Completed tasks keep Completed planning status. Record other work saves extra notes and attachments; use Next Step for stage changes and QA results.':
      '仅能编辑当前阶段的截止日期。已完成任务的 Planning status 保持 Completed。Record other work 用于记录额外说明和附件；阶段变更和 QA 结果通过 Next Step 确认。',
    'Completed tasks keep Completed planning status': '已完成任务的 Planning status 保持 Completed',
    'Only the current QA deadline can be edited': '仅能编辑当前 QA 阶段的截止日期',
    'Set the estimate in the current Engineering step': '请在当前 Engineering 阶段设置预计交付日期',

    'Review the PM design. Choose Confirmed and a delivery date to start Engineering; Needs Clarification or Cannot Complete returns the task to PM with your explanation.':
      '评估 PM 方案。选择 Confirmed 并确认交付日期后开始 Engineering；选择 Needs Clarification 或 Cannot Complete，并说明原因后，任务交回 PM。',
    'Expand PM source to read the original design. In Next Step review, choose Confirmed to start Engineering; Needs Clarification or Cannot Complete returns the task to PM with an explanation and an @ request. After accepting, use Return to PM if new questions arise. PM updates the design and resubmits Handoff.':
      '展开 PM source 查看原方案。初次评估通过 Next Step 选择 Confirmed 开始 Engineering；Needs Clarification 或 Cannot Complete 会带上说明交回 PM 并 @ 提醒。接受后若出现新问题，可使用 Return to PM。PM 修改方案后重新提交 Handoff。',
    'For tasks handed off from PM, Confirmed starts Engineering. Needs Clarification or Cannot Complete returns the same task to PM; explain the missing details or feasibility concern. After review, Return to PM is available in Next Step. Direct Engineering tasks retain their original review behavior.':
      'PM 交接来的任务选择 Confirmed 后开始 Engineering。Needs Clarification 或 Cannot Complete 会将同一条任务交回 PM，请说明缺少的细节或可行性问题。接受后可在 Next Step 使用 Return to PM。直接创建的 Engineering task 保留原评估行为。',
    'This task returns to PM with your explanation. PM must update the design and resubmit Handoff before Engineering continues.':
      '任务会带着你的说明交回 PM。PM 修改方案并重新提交 Handoff 后，Engineering 才会继续。',

    'Expand PM source to read the original design. In Engineering Next Step, choose Accept handoff & start Engineering or Return to PM; a return requires details and sends an @ request to PM. PM updates the design and resubmits Handoff to return the same task to Engineering.':
      '展开 PM source 查看原方案。通过 Engineering 的 Next Step 选择 Accept handoff & start Engineering 或 Return to PM；退回时填写需要补充的内容，系统会 @ PM。PM 修改方案并重新提交 Handoff 后，同一条任务回到 Engineering。',
    'In + New, Work type defaults to Engineering for Engineering members and PM Task for PM members. Members of both groups default to Engineering. You can change Work type before creating the task.':
      '在 + New 中，Engineering 分组默认选中 Engineering，PM 分组默认选中 PM Task。两个分组都具备时默认 Engineering。创建前可自行修改 Work type。',
    'Review the PM design and delivery date. Accept handoff to start Engineering, or return it to PM with the details needed.':
      '评估 PM 方案和交付日期。通过 Accept handoff 开始 Engineering，或填写需要补充的内容并交回 PM。',
    'Need clarification or a revised design? Return this task to PM with the details needed.':
      '如需澄清需求或调整方案，请填写需要补充的内容并将任务交回 PM。',
    'Describe the missing details, feasibility concern or design change needed. This same task returns to PM; PM receives an @ request and the next action.':
      '请说明缺少的细节、可行性问题或需要调整的方案。同一条任务会交回 PM，并 @ PM 分配下一步待办。',
    'For tasks handed off from PM, use Accept handoff & start Engineering to confirm the delivery date, or Return to PM to explain missing details or feasibility concerns. Directly created Engineering tasks keep the feasibility choices.':
      'PM 交接来的任务通过 Accept handoff & start Engineering 确认交付日期，或通过 Return to PM 说明需要补充的细节或可行性问题。直接创建的 Engineering task 保留可行性选项。',

    'Estimated delivery date defaults to today in gray when no estimate is saved or QA requests a new estimate. Change the date if needed; confirming Next Step saves the estimate.':
      '尚未保存预计日期，或 QA 退回后需要新日期时，Estimated delivery date 默认显示今天，字体为灰色。可按需要修改；确认 Next Step 后才保存预计日期。',
    'Use PM Task for requirements and design. Mark design ready and submit Handoff; the same record becomes an ordinary Engineering task for review and implementation.':
      '需求和方案使用 PM Task。通过 Mark design ready 确认方案，再提交 Handoff；同一条记录会成为普通 Engineering task，进入评估和实现流程。',
    'Choose Backlog or Planned for future work. Change Planning status to Active in Work tracking when work begins; in Engineering details, expand Task settings to find it.':
      '未来工作选择 Backlog 或 Planned。开始工作时，在 Work tracking 将 Planning status 改为 Active；Engineering 详情需要先展开 Task settings。',
    'In Engineering details, expand Task settings for Primary Owner and Collaborators. Assign specific assistance under Collaboration to request their action.':
      '在 Engineering 详情展开 Task settings 可设置 Primary Owner 和 Collaborators。通过 Collaboration 分配具体协助工作后，对方才会收到待办。',

    'Read Previous stage for the last completed result, notes and evidence. Task description and attachments follow it; expand Activity timeline for the full history.':
      'Previous stage 显示上一个阶段的结果、记录和附件。下方是任务描述及相关附件；完整历史可展开 Activity timeline 查看。',
    'The due date follows the current stage: entering QA gives QA seven days from Engineering delivery; passing QA gives Production seven days from the QA work date. Production delivery gives the completion check seven days.':
      '截止日期跟随当前阶段：进入 QA 后，QA 截止日期为 Engineering 交付日加七天；QA 通过后，Production 截止日期为 QA 完成日加七天；Production 交付后，完成检查再获得七天。',
    'If QA returns the task, enter a new Engineering estimated delivery date in Next Step before confirming progress or a fresh Stage handoff. The previous estimate stays in history.':
      'QA 退回任务后，请先在 Next Step 设置新的 Engineering 预计交付日期，再确认进度或重新交给 QA。旧日期保留在历史中。',
    'Expand Task settings for planning, primary owner, collaborators and follow-up reminders. These settings supplement Next Step; use Next Step to advance the workflow.':
      '展开 Task settings 可设置计划状态、负责人、协作者和跟进提醒。这里用于补充设置；任务流程通过 Next Step 推进。',
    'QA returned this task. Choose a new Engineering delivery date below.':
      'QA 已退回此任务，请在下方设置新的 Engineering 交付日期。',
    'Set the new estimate, then confirm progress or hand the fixed build to QA.':
      '设置新的预计日期后，确认进度或将修复后的版本交给 QA。',
    'Open Activity timeline below to read earlier stages.':
      '展开下方的 Activity timeline 查看更早的阶段。',
    'Use Next Step to record and advance work. These settings manage ownership, planning and follow-up reminders.':
      '通过 Next Step 记录并推进任务。这里管理负责人、计划状态和跟进提醒。',
    'Choose a new Engineering estimated delivery date of today or later':
      '请选择今天或之后的日期作为新的 Engineering 预计交付日期',

    'Design Ready highlights Choose engineer & hand off. Select an Engineering member and submit Handoff; this same record becomes an Engineering task and appears in Engineering filters.':
      'Design Ready 会突出显示 Choose engineer & hand off。选择 Engineering 成员并提交 Handoff 后，同一条记录会成为 Engineering task，并出现在 Engineering 筛选中。',
    'Handoff opens the ordinary Engineering task details. Use Next Step to review feasibility and delivery, then follow the existing Development, Stage, QA and Production workflow.':
      'Handoff 后打开普通 Engineering task 详情。通过 Next Step 评估可行性与交付时间，再沿用原来的 Development、Stage、QA 和 Production 流程。',
    'Expand PM source in Engineering details to read the original design or request PM details. A clarification during engineer review also returns the task to PM with an @ request. PM saves the added details and resubmits Handoff to return the same task to Engineering.':
      '在 Engineering 详情展开 PM source，可查看原方案或请求 PM 补充细节。Engineer review 中选择澄清需求也会将任务交回 PM 并 @ 提醒。PM 保存补充内容并再次提交 Handoff，同一条任务就会回到 Engineering。',
    'This Engineering task was handed off from PM. Its original design and handoff history stay with the same task.':
      '这条 Engineering task 由 PM 交接而来。原方案和交接历史保留在同一条任务中。',
    'Choose an engineer and submit Handoff. This same task then opens as an ordinary Engineering task.':
      '选择 Engineer 并提交 Handoff。随后，同一条任务会以普通 Engineering task 的形式打开。',
    'Handoff switches this record to an ordinary Engineering task and assigns it to that engineer.':
      'Handoff 会将同一条记录切换为普通 Engineering task，并分配给该 Engineer。',
    'Confirm the engineer and saved design. Handoff switches this record to an ordinary Engineering task and assigns it to that engineer.':
      '请确认 Engineer 和已保存的方案。Handoff 会将同一条记录切换为普通 Engineering task，并分配给该 Engineer。',
    'Continue in Engineering': '在 Engineering 中继续',
    'Continue in the ordinary Engineering Next Step': '通过普通 Engineering Next Step 继续',
    'Handoff submitted. This task is now in Engineering.':
      'Handoff 已提交，这条任务现在属于 Engineering。',
    'Choose a task with PM source details': '请选择带有 PM 来源资料的任务。',
    'Return this task to PM before editing its design': '请先将任务退回 PM，再修改方案。',

    'Changes to the requirement or design return this task to Draft. Save the changes, then review and mark the updated design ready again.':
      '修改需求或方案会将 Task 退回 Draft。保存修改后，请检查更新后的方案，再次标记就绪。',
    'PM workflow shows saved requirement and design checks. Save draft in Edit PM task, then click Mark design ready to review the saved design and confirm readiness.':
      'PM workflow 会显示需求和方案的保存情况。在 Edit PM task 中 Save draft，再点击 Mark design ready 查看已保存的方案并确认就绪。',
    'Design Ready highlights the next step: Choose engineer & hand off. Select an Engineering member and click Submit Handoff; the next action then moves to that engineer.':
      'Design Ready 会突出显示下一步 Choose engineer & hand off。选择 Engineering 成员并点击 Submit Handoff 后，下一步待办才会交给该 Engineer。',
    'Editing the requirement or design after Design Ready returns it to Draft. Review the updated version and use Mark design ready again before handoff.':
      'Design Ready 后修改需求或方案会退回 Draft。交接前，请检查更新后的版本，再次使用 Mark design ready 确认。',
    'If details are missing, the engineer clicks Request PM details and describes the question. PM receives an @ request and the next action; use Edit PM task to add details and Save details, then click Resubmit Handoff.':
      '内容不清楚时，Engineer 点击 Request PM details 并说明问题。PM 会收到 @ 请求和下一步待办；通过 Edit PM task 补充内容并 Save details，再点击 Resubmit Handoff。',
    'Requirement recorded': '需求已记录',
    'Design details recorded': '方案细节已记录',
    'Requested details updated': '所需补充内容已更新',
    Saved: '已保存',
    'Add a requirement': '补充需求',
    'Add design details': '补充方案细节',
    'Update the design': '更新方案',
    'Prepare the design': '准备设计方案',
    'Design ready to hand off': '方案已就绪，可以交接',
    'Waiting for requirement confirmation': '等待确认需求',
    'Details updated — ready to resubmit': '细节已补充，可以再次交接',
    'Add the requested details': '补充所需细节',
    'Engineering is underway': 'Engineering 正在处理',
    'Task completed': 'Task 已完成',
    'Record & review': '记录并检查',
    'Choose an engineer': '选择 Engineer',
    'Confirm requirements': '确认需求',
    'Engineering · QA · Release': 'Engineering · QA · Release',
    'Save your idea and proposed design. Review the scope, key behavior and acceptance details before marking the design ready.':
      '保存想法与设计方案。标记方案就绪前，请检查范围、关键行为与验收细节。',
    'Next, choose an engineer and submit Handoff. The next action moves to that engineer after submission.':
      '接下来，选择 Engineer 并提交 Handoff。提交后，下一步待办才会交给该 Engineer。',
    'The engineer reviews your design, confirms the requirement, or asks PM to add details.':
      'Engineer 会查看方案、确认需求，或请 PM 补充细节。',
    'Review the updated design, then submit Handoff to return the next action to the engineer.':
      '检查更新后的方案，再提交 Handoff，将下一步待办交回 Engineer。',
    'Use Edit PM task to add the requested details to the design. Save them, then submit Handoff again.':
      '通过 Edit PM task 在方案中补充所需细节。保存后，再次提交 Handoff。',
    'The task is complete. Its design, handoffs and activity remain available below.':
      'Task 已完成，方案、交接与 Activity 历史保留在下方。',
    'The ready design was changed. Review the updated version and mark it ready again.':
      '已就绪的方案发生了修改。请检查更新后的版本，再次标记就绪。',
    'Set Planning status to Active in Work tracking when you are ready to continue.':
      '准备继续时，在 Work tracking 将 Planning status 设为 Active。',
    'Handoff owner': '交接负责人',
    'Next action owner': '下一步负责人',
    'No further action needed.': '无需后续操作。',
    'Waiting for {owner} to continue.': '等待 {owner} 继续处理。',
    'Waiting for {owner} to confirm the requirement.': '等待 {owner} 确认需求。',
    'Add the requested details here. Saving keeps the task with PM until you resubmit Handoff.':
      '在这里补充所需细节。保存后，Task 仍由 PM 负责；再次提交 Handoff 才会交回 Engineer。',
    'Save your draft as you work. When the design is finished, use Mark design ready in PM workflow.':
      '可以随时保存草稿。方案完成后，在 PM workflow 使用 Mark design ready 确认就绪。',
    'Updates are saved with this task. Use the current workflow action to continue.':
      '更新会保存在这条 Task 中，请按当前流程操作继续。',
    'Design changed. Review it again and mark it ready.': '方案已修改，请重新检查并标记就绪。',
    'Details saved. Review them and resubmit Handoff.': '细节已保存，请检查后再次提交 Handoff。',
    'Draft saved. Review the design and mark it ready when finished.':
      '草稿已保存。请检查方案，完成后标记就绪。',
    'PM task updated.': 'PM task 已更新。',
    'Review your saved design below. Marking it ready opens the handoff step, where you choose an engineer and submit it.':
      '请检查下方已保存的方案。标记就绪后会进入交接步骤，再选择 Engineer 并提交。',
    'Confirm the engineer and saved design. Submission assigns the next action to that engineer.':
      '请确认 Engineer 与已保存的方案。提交后，下一步待办会分配给该 Engineer。',
    '{count} reference files attached.': '已附上 {count} 个参考文件。',
    'Check that the scope, key behavior and acceptance details are clear enough for the engineer to review.':
      '请检查范围、关键行为与验收细节，确保 Engineer 能够据此查看需求。',
    'Choose an engineer & submit Handoff': '选择 Engineer 并提交 Handoff',
    'This engineer receives the next action and reviews the requirement before implementation.':
      '该 Engineer 会收到下一步待办，并在实施前查看和确认需求。',
    'Engineer confirms or requests details': 'Engineer 确认需求或请求补充细节',
    'Design ready. Choose an engineer and submit Handoff.':
      '方案已就绪。接下来选择 Engineer 并提交 Handoff。',
    'Handoff submitted. Waiting for the engineer to confirm the requirement.':
      'Handoff 已提交，等待 Engineer 确认需求。',

    'Add the requested details in Edit PM task before submitting Handoff':
      '请先在 Edit PM task 补充所需细节，再提交 Handoff。',
    'Use PM Task for requirements and design. Complete the design, submit Handoff to an engineer, and wait for their confirmation before implementation.':
      'PM Task 用于需求与方案设计。完成方案后，提交 Handoff 给 Engineer，等待对方确认后再实施。',
    'Choose Backlog or Planned for future work, and Active when work begins. Edit Activity to update notes, date and attachments while retaining history.':
      '未来工作选择 Backlog 或 Planned，开始时改为 Active。Edit Activity 可修改文字、日期和附件，并保留历史。',
    'In Activity timeline, choose Edit activity to correct notes, date or attachments. Expand Edit history to read prior versions.':
      '在 Activity timeline 中，使用 Edit activity 修正文字、日期或附件。展开 Edit history 查看先前版本。',
    'Workload groups dated activities by work type and shows QA returns. Choose a date on Dashboard to review that day. Daily Work keeps its existing privacy.':
      'Workload 按工作类型整理当天的 Activity，并显示 QA 退回次数。在 Dashboard 选择日期查看当天工作；Daily Work 保持原有隐私范围。',
    'Review PM handoffs': '查看 PM 交接',
    'From PM design to Engineering': '从 PM 方案到工程实施',
    'Open a PM Task to review its design, handoff owner, requested details, images and history. Team overview is read-only.':
      '打开 PM Task 查看方案、交接负责人、待补充内容、图片与历史。Team overview 为只读。',
    'Create a PM Task, choose its PM owner and category, and use Edit PM task to record the requirement and design. Add reference images in Task images & files.':
      '新建 PM Task，选择 PM owner 与类别，通过 Edit PM task 记录需求和方案。在 Task images & files 上传参考图片。',
    'When the design is ready, click Complete design. Click Submit Handoff, select an Engineering member, and confirm.':
      '方案准备好后，点击 Complete design。再点击 Submit Handoff，选择 Engineering 成员并确认。',
    'The assigned engineer clicks Confirm requirement to continue the existing Engineering, Stage, QA and Production workflow within this same task.':
      '指定的 Engineer 点击 Confirm requirement 后，在同一条 task 内继续原有 Engineering、Stage、QA 和 Production 流程。',
    'If details are missing, the engineer clicks Request PM details and describes the question. PM receives an @ request and the next action; use Edit PM task to add details, then submit Handoff again.':
      '内容不清楚时，Engineer 点击 Request PM details 并说明问题。PM 会收到 @ 请求和下一步待办；通过 Edit PM task 补充内容后，再次提交 Handoff。',
    'Edit activity corrects dated work while retaining history. The PM owner or Admin can Archive or Delete at the bottom; shared or released history is preserved by archiving.':
      'Edit activity 可修正当天工作并保留历史。PM owner 或 Admin 可在底部 Archive 或 Delete；已有多人协作或已发布版本的历史会通过归档保留。',
    'Search engineers': '搜索 Engineer',
    'No matching engineers.': '没有匹配的 Engineer。',
    Unavailable: '当前不可选',
    'No work recorded for this date.': '这个日期尚未记录工作。',
    'Record the requirement and design, then mark the design ready.':
      '记录需求与设计方案，完成后标记方案已准备好。',
    'Submit the completed design to an engineer for confirmation.':
      '将完成的方案提交给 Engineer 确认。',
    'Confirm the requirement, or return it to PM with the details you need.':
      '确认需求，或说明需要补充的内容并退回 PM。',
    'Add the requested details and submit the handoff again.': '补充所需内容后，再次提交 Handoff。',
    'PM work completed. Review the history below.': 'PM 工作已完成，可在下方查看历史。',
    'Requirement confirmed. Continue the Engineering workflow below.':
      '需求已确认，请继续下方的 Engineering 流程。',
    'Add the requirement, problem and intended outcome.': '补充需求、要解决的问题和预期结果。',
    'Record the proposed design and acceptance details before Handoff.':
      'Handoff 前请记录方案和验收细节。',
    'No handoffs yet.': '尚无交接记录。',
    'Describe the proposed solution, key behavior and acceptance details.':
      '描述方案、关键行为与验收细节。',
    'Mark this design ready for Engineering handoff.': '确认方案已准备好，可以交接给 Engineering。',
    'The engineer will confirm the requirement before implementation.':
      'Engineer 会在开始实施前确认需求。',
    'Continue the existing Engineering workflow within this task.':
      '在这条 task 内继续原有 Engineering 流程。',
    'Describe what needs clarification. PM receives an @ request and the next action.':
      '说明需要澄清的内容。PM 会收到 @ 请求和下一步待办。',
    'Return the design to Draft to continue editing.': '将方案退回 Draft，继续修改。',
    'Record the requirement and design. Complete the design, then hand it to an engineer for confirmation.':
      '记录需求与方案。完成方案后，交给 Engineer 确认。',
    'Choose a PM Task': '请选择 PM Task。',
    'Task changed. Reopen it before confirming.': 'Task 已更新，请重新打开再确认。',
    'Only the PM owner or Admin can change the design': '只有 PM owner 或 Admin 可以修改方案。',
    'Only the assigned engineer or Admin can confirm this handoff':
      '只有指定的 Engineer 或 Admin 可以确认这次交接。',
    'Choose a PM handoff action': '请选择 PM 交接操作。',
    'Activate this task before using Handoff': '使用 Handoff 前请将 Task 改为 Active。',
    'This task is already completed': '这条 Task 已完成。',
    'Complete the current draft before Handoff': 'Handoff 前请先完成当前方案。',
    'Record the design in Edit PM task first': '请先在 Edit PM task 中记录方案。',
    'Only a ready design can return to Draft': '只有 Design Ready 的方案可以退回 Draft。',
    'Complete the design or requested details before Handoff':
      'Handoff 前请完成方案或所需补充内容。',
    'Record the design before Handoff': 'Handoff 前请先记录方案。',
    'Return this clarification to the current engineer': '请将这次补充内容交回当前 Engineer。',
    'This handoff is not awaiting confirmation': '当前交接没有等待确认。',
    'This task cannot be returned to PM at this step': '当前步骤无法将 Task 退回 PM。',
    'Describe the details PM needs to add': '请说明 PM 需要补充的内容。',
    'Use the PM handoff workflow': '请使用 PM 交接流程。',
    'Complete the PM handoff before Engineering work':
      '开始 Engineering 工作前，请先完成 PM 交接。',
    'Use Edit PM task to update the requirement and design': '请通过 Edit PM task 更新需求和方案。',
    'Only Admin or the PM owner can remove this task': '只有 Admin 或 PM owner 可以移除此 Task。',
    'Only Admin or the PM owner can archive this task': '只有 Admin 或 PM owner 可以归档此 Task。',
    'Only Admin or the PM owner can restore this task': '只有 Admin 或 PM owner 可以恢复此 Task。',

    'No requests need your response.': '目前没有需要你回应的请求。',
    'No related tasks are waiting on someone else.': '目前没有相关 task 正在等待其他人处理。',
    'No tasks need follow-up.': '目前没有需要跟进的 task。',
    '{days} days without progress': '{days} 天没有实际进展',

    'Needs My Action shows the step currently owned by you. Unassigned tasks remain on the shared board; work waiting for another person appears in Waiting on Others.':
      'Needs My Action 只显示当前由你负责的步骤。未分配 task 保留在共享 Board；等待其他人的工作显示在 Waiting on Others。',
    'Quick Tasks and PM work': 'Quick Task 与 PM 工作',
    'Use Quick Task for independent small work. Choose its owner, record dated Activity and confirm To Do, In Progress or Completed without QA or Release.':
      '独立的小工作使用 Quick Task，选择 Owner、记录 dated Activity，并确认 To Do、In Progress 或 Completed；无需 QA 或 Release。',
    'Use PM Task for product work. Select a PM owner and work category; link an Engineering task when implementation is ready.':
      '产品工作使用 PM Task，选择 PM Owner 和工作类别；准备开发时关联 Engineering task。',
    'Choose Backlog or Planned for future work, and Active when work begins. Edit Activity to update notes, time and attachments while retaining history.':
      '未来工作选择 Backlog 或 Planned，开始时改为 Active。Edit Activity 可修改文字、工时和附件，并保留历史。',
    'Independent small work uses a task. Work that belongs to an existing task should be added as Activity.':
      '独立小工作使用 task；属于已有 task 的工作应直接添加 Activity。',

    'Planning, collaboration and follow-up': '规划、协作与跟进',
    'Your actions and follow-ups': '你的待办与跟进',
    'In + New, choose Engineering, Quick Task or PM Task. Quick Tasks use To Do, In Progress and Completed; use Activity on an existing task when the work belongs there.':
      '在 + New 选择 Engineering、Quick Task 或 PM Task。Quick Task 使用 To Do、In Progress 和 Completed；属于已有 task 的工作应直接添加 Activity。',
    'Choose Backlog or Planned for future work. Open Work tracking and change Planning status to Active when work should begin.':
      '未来工作选择 Backlog 或 Planned；准备开始时，在 Work tracking 将 Planning status 改为 Active。',
    'In Work tracking, keep a Primary Owner and choose Engineering collaborators. Assign specific assistance under Collaboration to request their action.':
      '在 Work tracking 保留 Primary Owner，选择 Engineering 协作者。在 Collaboration 分配具体协助工作后，对方才会收到待办。',
    'QA due date starts seven days after entering QA. After QA returns work to Engineering, set a new Engineering estimated delivery date before the next QA round.':
      'QA due date 默认是进入 QA 的日期加七天。QA 退回 Engineering 后，应在再次送测前重新设置 Engineering 预计交付日期。',
    'Use Undo Stage Change only for the latest mistaken transition, with a reason. Activity remains in history. Use the QA result to formally return failed work to Engineering.':
      '只有最新的误操作阶段变化可用 Undo Stage Change 撤回，并须填写原因；Activity 保留。正式 QA 不通过应使用 QA result 退回 Engineering。',
    'In Activity timeline, choose Edit activity to correct notes, date, time or attachments. Expand Edit history to read prior versions.':
      '在 Activity timeline 选择 Edit activity 修改文字、日期、工时和附件；展开 Edit history 查看之前的版本。',
    'Needs My Action shows your current task steps, explicitly assigned collaboration and Discussion requests. Waiting on Others shows related work waiting for another person.':
      'Needs My Action 显示你当前负责的步骤、明确分配的协作和 Discussion 请求。Waiting on Others 显示与你有关但正在等别人的工作。',
    'When posting a Discussion, choose the people whose response you need. Reply to their request or choose Resolved to clear your action.':
      '发布 Discussion 时选择需要回应的人；回复请求或选择 Resolved 后，对应待办会清除。',
    'Needs Follow-up shows At Risk after five days, owner reminders after seven days and Stale after ten days without actual work. Due dates show Overdue separately.':
      '无实际工作进展五天显示 At Risk，七天提醒 Owner，十天显示 Stale。超过截止日期另显示 Overdue。',
    'For blocked work, set Blocked / waiting reason and Follow-up date in Work tracking. Backlog and Planned work do not generate reminders.':
      '遇到阻碍时，在 Work tracking 填写 Blocked / waiting reason 和 Follow-up date。Backlog 和 Planned 不产生提醒。',
    'Workload lists activity, participation and recorded time by role and category. Daily Work keeps its existing privacy.':
      'Workload 按角色和类别列出 Activity、参与情况和已记录工时；Daily Work 保持原有隐私规则。',
    'Set a new Engineering delivery date before sending the fixed build to QA.':
      '修复后再次送 QA 前，请重新设置 Engineering 交付日期。',
    'Restore the previous stage without deleting activity. Use the QA result for a formal return to Engineering.':
      '恢复上一阶段并保留 Activity；正式退回 Engineering 应使用 QA result。',

    'Stays here until you confirm you’ve read it.': '点击 I understand 后，这条使用说明才会收起。',
    'I understand': '我知道了',
    'Instructions for your work groups. Read any guide again here. Each confirmation is saved only for your account.':
      '这里展示适用于你所属 Work groups 的使用说明，可以随时重新查看。阅读确认只对你的账号生效。',
    'Open a task to view its details or log work.': '点击 task 查看详情或记录工作。',
    'No tasks yet. Add a task to break this project into smaller pieces of work.':
      '还没有 task。点击 + Task，把 project 拆成具体的工作事项。',
    'Daily work, engineering progress and upcoming releases.':
      '查看大家每天做了什么、Engineering 进度和接下来的版本。',
    'Loading team overview…': '正在加载团队情况…',
    'Loading versions…': '正在加载版本…',
    'Loading activity…': '正在加载工作记录…',
    'Loading private work…': '正在加载私人工作…',
    'Loading workspace…': '正在加载 workspace…',
    'Weekly Wednesday releases: delivered changes and upcoming plans.':
      '每周三发布新版本，查看本次更新和后续计划。',
    'See what everyone worked on today before reviewing priorities.':
      '先看看大家今天做了什么，再查看待处理事项。',
    'Your daily activity is private to you and the boss.':
      '你的每日工作记录仅你自己和 Manager 可见。',
    'New activity and office entries appear here automatically.': '新的工作记录会自动显示在这里。',
    'Dated shared-task work and private records visible to your role':
      '所选日期的共享 task 工作和你有权限查看的私人记录',
    'Across engineering projects': '所有 Engineering 项目',
    'On Stage / ready to test': '已上 Stage，可以测试',
    'QA feedback and questions': 'QA 反馈和待确认问题',
    'Open a task to review its next step, discuss requirements, or add a work update.':
      '打开 task，查看下一步、讨论需求或记录工作进展。',
    'Review scope and delivery date': '确认需求范围和预计交付日期',
    'Test the confirmed Stage build': '测试工程师已确认的 Stage 版本',
    'Deploy and verify Production': '部署到 Production 并验证结果',
    'Fix QA feedback, then merge to Stage': '修复 QA 反馈，再 merge 到 Stage',
    'Continue development, then merge to Stage': '继续开发，再 merge 到 Stage',
    'No tasks currently need an action.': '目前没有需要处理的 task。',
    'What needs to happen next, ordered by priority.': '接下来要做什么，按 Priority 排序。',
    'Search tasks, projects or people': '搜索 task、project 或成员',
    'Search tasks or project names': '搜索 task 或 project 名称',
    'The board updates as you choose.': '选择后立即筛选。',
    'Track requests, bugs, PRs, deployments and QA independently.':
      '集中跟进需求、bug、PR、部署和 QA。',
    'Try another search or clear the filters.': '换个关键词，或清除筛选条件。',
    'Archived tasks will appear here.': '已归档的 task 会显示在这里。',
    'Use + New to add your first task.': '点击 + New 添加第一个 task。',
    'See what everyone worked on each day.': '查看大家每天具体做了什么。',
    'Your ongoing projects, small tasks and daily activities.':
      '管理持续进行的 project、task 和每日工作记录。',
    'Activity History is Admin only.': 'Activity History 仅 Admin 可查看。',
    'Append-only work log. Original actions and timestamps are never overwritten.':
      '查看原始操作记录和时间；历史记录会保留。',
    'Filter by task, person or result': '按 task、成员或结果搜索',
    'Activity entries appear here automatically.': '工作记录会自动显示在这里。',
    'Only Admin can manage members.': '仅 Admin 可管理成员。',
    'Admin manages team accounts. Private daily entries remain visible only to the owner and boss.':
      'Admin 管理团队账号；私人每日工作记录仅本人和 Manager 可见。',
    'Create an email account, assign its system role and work groups, then set its password.':
      '使用邮箱创建账号，设置 Role 和 Work groups，再设置密码。',
    'Review the engineering request.': '查看这项 Engineering 需求。',
    'Drop images or files here, click to choose, or paste screenshots with Ctrl/Cmd + V':
      '拖拽图片或文件到这里，点击选择，或用 Ctrl/Cmd + V 粘贴截图',
    'Tap to add photos or files': '轻点添加照片或文件',
    'Click to choose images or files': '点击选择图片或文件',
    'e.g. Fixed the issue and checked the result.': '例如：已修复问题，并确认结果正常。',
    'Can this request be completed? *': '这个需求可以完成吗？ *',
    'Required when the engineer confirms it can be completed.':
      '确认可以完成时，需要填写预计交付日期。',
    'What did you test? What happened?': '测试了什么？结果如何？',
    'Confirm the merge to Stage only when this build is available for testing. The same confirmation assigns QA and starts testing.':
      '确认这个版本已 merge 到 Stage 并可测试后，再选择 QA 并确认，一次完成交接。',
    'QA passed this Stage build. Confirm after the production deployment and verification are complete.':
      '这个 Stage 版本已通过 QA。完成 Production 部署并验证后，再确认。',
    'Shown until the next action on this task. Comments remain in Discussion.':
      '提示会保留到 task 的下一次实际 action。原 comment 仍保留在 Discussion。',
    'e.g. Checked the updated page. The buttons now work.':
      '例如：检查了更新后的页面，按钮已经可以正常使用。',
    'e.g. Checked and working': '例如：已检查，运行正常',
    'e.g. Should this change apply to all users?': '例如：这次修改是否应该适用于所有用户？',
    'Archive preserves history and can be restored. Tasks with shared work or released-version history are archived when removed.':
      'Archive 会保留历史，并支持恢复。有多人协作或已发布版本记录的 task 会保留为归档。',
    'Field changes save after confirmation. Follow Next Step for the workflow. Record other work in Task details & PR when needed.':
      '修改字段后确认保存。按 Next Step 推进流程；其他工作可在 Task details & PR 中记录。',
    'Follows development stage; you can override it.': '会随开发阶段自动更新，也可以手动修改。',
    'This work item is no longer available': '这项工作已不可用。',
    'e.g. Fix a login issue': '例如：修复登录问题',
    'e.g. Users cannot sign in. They should be able to open their account.':
      '例如：用户无法登录，修复后应能正常进入账号。',
    'The engineer reviews feasibility first. Confirm merged to Stage and assign QA in the same step.':
      '工程师先确认可行性。之后确认已 merge 到 Stage，并在同一步选择 QA 完成交接。',
    'Only you and the manager can view your private work.':
      '你的私人工作记录仅你自己和 Manager 可见。',
    'e.g. Update the price list': '例如：更新价格表',
    'e.g. Updated the price list. Waiting for approval.': '例如：已更新价格表，等待确认。',
    'Add a task for ongoing or already completed work. Log dated progress as activities when you work on it.':
      '可以添加持续进行或已经完成的 task。每次做了工作，再添加对应日期的 activity。',
    'e.g. Prepare the monthly report': '例如：准备月度报告',
    'Choose Completed for finished work. Completed tasks appear under Completed or All work; add a dated activity to record the work you did.':
      '已经做完的 task 可直接选择 Completed，在 Completed 或 All work 下查看；再添加 activity 记录当天做了什么。',
    'e.g. Check the latest prices and update the price list.': '例如：核对最新价格，并更新价格表。',
    'Engineering and QA are independent of system role. Management provides the team overview. Combine it with a work group to enable My work and Team overview. Admin permissions come from the system role. Set a password after saving.':
      'Work groups 决定 Engineering、QA 和 Management 权限。Management 与其他分组组合时，可以切换 My work / Team overview。Admin 权限由 Role 决定。保存账号后再设置密码。',
    'Work saved. Some images could not upload; click Save again to retry without creating another record.':
      '工作已保存，但部分图片上传失败。再次点击 Save 重试，不会重复创建记录。',
    'Task changes recorded in timeline': 'task 修改已记录到 Activity timeline。',
    'Activity saved; some images could not be uploaded. Add them to that activity to retry.':
      'activity 已保存，但部分图片上传失败。请在这条 activity 中重新添加。',
    'Comment saved; some images could not be uploaded. Add them to that comment to retry.':
      'comment 已保存，但部分图片上传失败。请在这条 comment 中重新添加。',
    'Unable to download attachment': '附件下载失败。',
    'Choose at least 12 characters.': '密码至少需要 12 个字符。',
    'Use your Work Tracker email and password.': '使用你的 Work Tracker 邮箱和密码登录。',
    'Use at least 12 characters.': '密码至少需要 12 个字符。',
    'New passwords do not match.': '两次输入的新密码不一致。',
    'Password updated. Sign in with your new password.': '密码已更新，请用新密码重新登录。',
    'Password saved. Share it privately with this member.': '密码已保存，请私下告知这位成员。',
    'No upcoming versions planned': '还没有待发布的版本。',
    'Plan the next Wednesday release to begin.': '先创建下一个周三的发布计划。',
    'Select Engineering Board tasks to build a release plan.':
      '从 Engineering Board 选择 task，安排版本更新。',
    'The next Wednesday version is planned automatically. A new plan opens after actual release.':
      '会自动计划下一个周三的版本；当前版本实际发布后，再创建下一版计划。',
    'Automatically includes tasks moved to On Production after':
      '自动包含此日期之后进入 On Production 的 task：',
    '. Review before recording this release; uncheck and save to exclude. Future work can be selected manually.':
      '。确认发布前请检查；取消勾选并保存即可排除。后续计划中的工作可以手动选择。',
    'Add work from the Engineering Board below.': '从下方 Engineering Board 选择要包含的工作。',
    'No Engineering Board tasks yet.': 'Engineering Board 还没有 task。',
    'Defaults to today. Check the date before confirming the release.':
      '默认今天，确认实际发布前请核对日期。',
    'Save the plan at any stage. Record a released version only after selected tasks are On Production or Closed. This records the release; it does not deploy CRM code. Released records are locked.':
      '计划随时可以保存。选中的 task 全部为 On Production 或 Closed 后，才能确认实际发布。此操作记录发布情况，不会部署代码；已发布记录会锁定。',
    'Choose the actual release date': '请选择实际发布日期。',
    'Release recorded and locked': '发布已记录并锁定。',
    'Update name, role and work groups. Saving these changes preserves the existing password.':
      '可以修改姓名、Role 和 Work groups。保存这些信息不会更改现有密码。',
    'No activity logged for this date.': '这一天还没有工作记录。',
    'No Engineering Board updates for this date.': '这一天还没有 Engineering Board 工作记录。',
    'Engineering can create the next release plan.': 'Engineering 可以创建下一个版本计划。',
    '· Shared task activity and personal daily entries': '· 共享 task 工作和个人每日工作记录',
    'Expected features and fixes': '预计新增功能和修复内容',
    'No board activity for this date.': '这一天还没有看板工作记录。',
    'Your ongoing tasks. Open a row to continue work or log an activity.':
      '这里展示持续进行的 task。点击任意一行查看详情或添加 activity。',
    'Try another search or status.': '换个关键词或 Status 筛选。',
    'Use + Activity, then choose Task to add ongoing work.':
      '点击 + Activity，再选择 Task，添加需要持续跟进的工作。',
    'This removes it from your workspace. Its change record is retained.':
      '这项工作会从 workspace 中移除，修改记录会保留。',
    'Discard unsaved changes?': '放弃未保存的修改？',
    'Your task changes have not been saved.': '你对 task 的修改还没有保存。',
    'This task has shared work, child tasks or released-version history. Archiving preserves these records.':
      '这个 task 有协作记录、子 task 或已发布版本记录。Archive 会保留这些内容。',
    'This task will be removed from the active board. Tasks with multiple contributors or released-version history will be archived instead.':
      '这个 task 将从 Active 看板移除。有多人协作或已发布版本记录时，会改为归档。',
    'Each image/file must be 8 MB or smaller': '每个图片或文件不能超过 8 MB。',
    'Choose a QA owner for the merge-to-Stage handoff':
      '请先选择 QA owner，再确认 merge 到 Stage 的交接。',
    'The request stays on hold until the scope is clarified and reviewed again.':
      '需求会保持 On Hold，直到范围明确并重新确认。',
    'QA passed. The engineer can deploy this Stage build to Production.':
      'QA 已通过，工程师可以把这个 Stage 版本部署到 Production。',
    'Return to Engineering. QA waits until the fixed build is confirmed on Stage again.':
      '交回 Engineering 修复。工程师再次确认修复后的版本已上 Stage 后，再进行 QA。',
    'Mark On Production and automatically include it in the pending version update.':
      '标记为 On Production，并自动计入当前待发布版本。',
    '. QA continues to wait for Stage confirmation.': '。QA 会继续等待工程师确认 Stage。',
    'Step saved. Some images failed to upload; retry from Images for this step.':
      '这一步已保存，但部分图片上传失败。请从 Images for this step 重新添加。',
    'Due reminders continue until you complete the occurrence. Only actual activities count as daily work.':
      '到期的工作会继续提醒，直到你完成这次任务。做了工作后，请添加 activity。',
    'Leave unchecked if you only finished this activity.':
      '如果只完成了这次 activity，请不要勾选。',
    'This completes the whole task and stops future repeat reminders.':
      '这会完成整个 task，并停止后续周期提醒。',
    '. Partial or blocked work counts today; the due reminder stays until this occurrence is completed.':
      '。可以记录部分进展或 Blocked 情况；完成本次任务前，到期提醒会保留。',
    'Record what you did. This update counts toward the selected day’s work.':
      '记录你做了什么，会显示在所选日期的工作记录中。',
    'e.g. Finished the first draft. Waiting for feedback.': '例如：完成了初稿，等待反馈。',
    'Partial work keeps the reminder. Completing this occurrence advances the next due date.':
      '只完成部分工作时会继续提醒；完成本次任务后，会推进到下次到期日。',
    'Activity saved. Some images failed to upload; save again to retry without creating another entry.':
      'activity 已保存，但部分图片上传失败。再次保存可重试，不会重复创建记录。',
    'Completing the task stops its repeat reminders.': '完成整个 task 后，周期提醒也会停止。',
    'Project reference files, such as requirements and design mockups.':
      'project 的参考资料，例如需求文档和设计稿。',
    'Reference images and files for this task.': '这个 task 的参考图片和文件。',
    'Daily progress for this project and its tasks.': '这个 project 及其 task 的每日进展。',
    'Continue this task across days.': '可以在不同日期继续记录这个 task 的进展。',
    'Add screenshots of daily progress to the corresponding activity.':
      '当天进展的截图请添加到对应的 activity 中。',
    'Each entry records the work date, result, details and images.':
      '每条记录包含工作日期、结果、说明和图片。',
    'Due tasks and work that needs a progress update.': '已到期的 task 和需要更新进展的工作。',
    'Return this item to active work.': '把这项工作恢复到 Active。',
    'Keep its activity and attachments, and move it out of active work.':
      '保留 activity 和附件，并从 Active 中移除。',
    'Child tasks keep their individual state.': '子 task 会保持各自的状态。',
    'Your work and the team overview': '切换个人工作与团队情况',
    'Use My work and Team overview at the top of the page to switch views. My work opens by default.':
      '使用页面顶部的 My work / Team overview 切换视角，默认进入 My work。',
    'My work shows your personal Next actions, Daily Work, tasks, projects and reminders. Use shared boards for work permitted by your assigned groups.':
      'My work 展示你的 Next actions、Daily Work、task、project 和提醒；也可以按所属分组权限使用共享看板。',
    'Team overview shows everyone’s dated activity, engineering progress and versions. This view is read-only; other people’s private ongoing boards are not shown.':
      'Team overview 展示大家每日的 activity、Engineering 进度和版本。这里用于查看，不展示别人的私人持续任务看板。',
    'Switch back to My work to add activity or advance a task. Confirm before discarding an unfinished draft.':
      '添加 activity 或推进 task 时，切回 My work。切换前如有未保存的内容，需要确认是否放弃。',
    'Your Manager overview': '查看团队工作',
    'Start with your next actions': '从 Next actions 开始',
    'Choose a date to review each person’s work. Click an entry to read its details and view screenshots.':
      '选择日期查看大家做了什么，点击记录查看详情和截图。',
    'Daily Work shows dated team activity. Personal projects, ongoing tasks and reminders stay in each person’s workspace.':
      'Daily Work 展示指定日期的团队 activity。私人 project、持续 task 和提醒留在各自 workspace 中。',
    'Engineering Board and Version Control show shared progress and upcoming releases; your workspace is for viewing.':
      'Engineering Board 和 Version Control 展示共享进度和待发布版本；Manager 视角用于查看。',
    'On a phone, use the bottom navigation to switch sections. Swipe it sideways for more sections; use the account icon at the top for account settings.':
      '手机上使用底部导航切换页面，左右滑动可查看更多入口；点击顶部账号图标打开账号设置。',
    'Next actions shows the task, what needs to happen and who owns the next step. Click any row to open the task.':
      'Next actions 展示 task、下一步要做什么和负责人。点击任意一行打开 task。',
    'Your engineering queue includes work assigned to you, next actions owned by you, and unassigned tasks. The shared board still shows all tasks.':
      '你的 Engineering 队列展示分配给你、下一步由你负责，以及尚未分配的 task。共享看板仍可查看全部 task。',
    'Open tasks waiting for QA and test only the build that Engineering has confirmed is on Stage.':
      '打开等待 QA 的 task，只测试 Engineering 已确认上 Stage 的版本。',
    'Use Daily Work for your personal tasks and ongoing projects; use Engineering Board for shared team requests.':
      '私人 task 和持续 project 放在 Daily Work，团队共享需求放在 Engineering Board。',
    'Use Discussion to ask questions or clarify requirements. Click Reply to respond to a comment, and attach screenshots when helpful.':
      '在 Discussion 中提问或讨论需求。点击 Reply 回复 comment，需要时可以附上截图。',
    'Review daily team activity': '查看团队每日工作',
    'Tasks, projects and daily activity': '管理 task、project 和每日工作',
    'Select a date and, optionally, a team member to review their work for that day.':
      '选择日期查看当天工作，也可以进一步选择成员。',
    'Click a daily entry to read its details and attached images. You do not see private ongoing project or task boards.':
      '点击每日记录查看详情和图片；Manager 视角不展示私人持续 project 或 task 看板。',
    'Use + Activity for work you did today. Choose Task in that form for ongoing work, or choose its Completed status for a task you have already finished.':
      '点击 + Activity 记录今天做了什么。需要持续跟进时，在表单中选择 Task；已经完成的 task 可直接选择 Completed。',
    'Daily Work Board lists ongoing tasks. Click a row to log more work, edit it, attach images or change its status.':
      'Daily Work Board 展示持续 task。点击任意一行，记录新进展、编辑、添加图片或修改 Status。',
    'Use + Project above Daily Work Board to group related tasks. Projects appear separately above the board; a task can also stand alone.':
      '点击 Daily Work Board 上方的 + Project 组织相关 task。project 单独显示在看板上方，task 也可以不属于任何 project。',
    'Use the dashed upload area for images or files: drag them in, click to choose, or paste screenshots. On a phone, tap it to choose photos or files.':
      '在虚线上传区拖拽图片或文件、点击选择，或粘贴截图；手机上轻点即可选择照片或文件。',
    'Expand Daily Work activity to review dated entries. Your private work is visible to you; the Manager can review its daily activity.':
      '展开 Daily Work activity 查看每日记录。私人持续工作由你管理，Manager 可以查看每日 activity。',
    'Working within a project': '使用 project',
    '+ Task in Related tasks creates a piece of work within this project. Choose Completed when adding a task that is already finished. The Add activity form is already open below the related tasks and defaults to this project.':
      '在 Related tasks 点击 + Task，创建属于这个 project 的任务。已做完的 task 可选 Completed。下方 Add activity 默认属于当前 project。',
    'In the activity form, choose Project itself or one of its tasks. Attach progress screenshots. For a finished task, choose Completed and check Also complete task.':
      '添加 activity 时，选择 Project itself 或某个 task，并附上进展截图。整个 task 已完成时，选择 Completed 并勾选 Also complete task。',
    'Click the status tag in the project overview, choose In Progress, Waiting or Completed, then confirm. Edit project lets you upload or manage project reference attachments. The overview previews existing files; the timeline contains dated work.':
      '点击 project 概览的状态 tag，选择 In Progress、Waiting 或 Completed 后确认。Edit project 中管理参考附件；概览预览文件，timeline 查看每日进展。',
    'Use a dashed upload area to drop images or files, click to choose files, or paste screenshots. On a phone, tap that area to choose photos or files.':
      '在虚线上传区拖入图片或文件、点击选择，或粘贴截图。手机上轻点选择照片或文件。',
    'Archive and Delete are inside Edit project. Archiving retains history; archived work can be restored from the board filter.':
      '在 Edit project 中使用 Archive 或 Delete。Archive 保留历史，在看板筛选中可找到并恢复。',
    'Continue a task across days': '跨天继续 task',
    'Opening a task shows its Overview and the Add activity form. Record progress and attach images directly; expand Activity history to review earlier updates.':
      '打开 task 即可看到 Overview 和 Add activity，直接记录进展、添加图片；展开 Activity history 查看之前的记录。',
    'Choose Completed as the activity result when an update is finished. Check Also complete task if the entire task is done; for repeat tasks this ends future reminders.':
      '本次工作完成时，Activity result 选 Completed。如果整个 task 已结束，再勾选 Also complete task；周期 task 的后续提醒也会停止。',
    'Click the status tag in Overview, choose In Progress, Waiting or Completed, then confirm. Use Edit task for title, description and repeat settings; edit dated updates in Activity history.':
      '点击 Overview 的状态 tag，选择 In Progress、Waiting 或 Completed 后确认。标题、说明和周期设置在 Edit task 中修改；每日记录在 Activity history 中编辑。',
    'Repeat / reminders schedules recurring work. Log the work when you do it and mark the occurrence complete to advance its due date; overdue work remains due.':
      '在 Repeat / reminders 设置周期任务。做了工作时添加记录，完成本次任务后会推进到下次到期日；未完成的到期工作会继续提醒。',
    'When a task shows Update needed, open it and record your latest progress in Add activity.':
      '看到 Update needed 时，打开 task，在 Add activity 中记录最新进展。',
    'Archive and Delete are inside Edit task. To restore archived work, select Archived work on Daily Work Board.':
      'Archive 和 Delete 在 Edit task 中。需要恢复时，在 Daily Work Board 选择 Archived work。',
    'Using the shared Engineering Board': '使用共享 Engineering Board',
    'Click a task to view its next step, feedback, screenshots and history.':
      '点击 task 查看下一步、反馈、截图和历史。',
    'Create a shared request with + New. Use a broad category and optionally link it to a parent task.':
      '点击 + New 创建共享需求，选择 Category，需要时关联 Parent task。',
    'Click anywhere on a task row to open it. Search by task, project or person. Switch between Active and Archived above the board.':
      '点击 task 行的任意位置打开详情。可搜索 task、project 或成员，在看板上方切换 Active / Archived。',
    'Open Filters to choose category, development stage, QA status or sorting. QA groups are Ready to test, Needs changes, Passed and Blocked; detailed test results remain in the task. Choices apply immediately. Remove a selected filter with its ×, or use Clear all; Done closes the panel.':
      '点击 Filters，筛选 Category、Development stage、QA status 或排序。QA 分为 Ready to test、Needs changes、Passed 和 Blocked；详细结果在 task 中查看。选择立即生效；点击 × 移除单项，Clear all 清除筛选，Done 收起面板。',
    'Next Action shows the next step and its owner. Open the task to carry out that step; Daily Engineering Activity below shows the selected day’s work.':
      'Next Action 展示下一步和负责人，打开 task 执行对应操作。下方 Daily Engineering Activity 显示所选日期的工作。',
    'Archive and Delete are directly visible at the bottom of task details. Shared or released tasks are preserved by archiving. Use Archived tasks to find and restore them.':
      'task 详情最下方有 Archive 和 Delete。协作或已发布 task 会保留为归档，可在 Archived 中找到并恢复。',
    'Archived tasks are available from the Board scope filter.':
      '在看板上方选择 Archived，查看已归档 task。',
    'Reading an engineering task': '查看 Engineering task',
    'Follow the task’s next step': '按 Next Step 推进 task',
    'Read Next Step to see the responsible person and required action; expand Activity timeline or Discussion for context.':
      '在 Next Step 查看负责人和下一步，展开 Activity timeline 或 Discussion 查看背景。',
    'Next Step is the main workflow entry: use its confirmation button to record and advance work. Task details & PR holds reference fields and an optional log for other work.':
      '在 Next Step 完成对应操作并确认，记录工作和推进流程。参考字段和其他工作记录入口在 Task details & PR 中。',
    'Review feasibility and estimated delivery first. Record development stages, then select Merged to Stage → QA only after the Stage build is ready to test; choose QA and confirm once.':
      '先确认可行性和预计交付日期，再记录开发阶段。只有 Stage 版本已可测试时，才选择 Merged to Stage → QA、选 QA 并确认交接。',
    'QA starts after Engineering confirms the Stage build. Record a test result and screenshots; problems return to Engineering, and fixes need a fresh Stage confirmation before retesting.':
      'Engineering 确认 Stage 后才开始 QA。记录结果和截图；有问题则交回 Engineering，修复后需重新确认 Stage 再复测。',
    'Engineering reviews scope and delivery, develops the change and confirms Stage before QA tests it. Passed QA then allows Production handoff.':
      'Engineering 先确认范围和交付日期，完成开发并确认 Stage 后交给 QA。QA 通过后再交接 Production。',
    'Click Reply on a highlighted comment to write underneath it. Add images if needed, then click Post reply. Open Discussion to read or reply to older comments.':
      '在高亮 comment 点击 Reply，即可在其下方回复。需要时添加图片，再点击 Post reply。旧 comment 可在 Discussion 中查看和回复。',
    'You can record work on a task assigned to another engineer. Keep the Assignee unchanged. Once the change is on Production, add your completion notes in Next Step and click Confirm task complete.':
      '你也可以在分配给其他工程师的 task 中记录自己的工作，保留原 Assignee。变更已上 Production 后，在 Next Step 写完成说明，点击 Confirm task complete。',
    'Archive and Delete are at the bottom of task details. Archive retains history; shared or released tasks can only be archived. Delete asks for confirmation.':
      'Archive 和 Delete 在 task 详情最下方。Archive 保留历史；协作或已发布 task 只能归档。Delete 需要二次确认。',
    'Use the dashed area to drop images or files, click to choose files, or paste screenshots with Ctrl/Cmd + V. On a phone, tap the area to choose photos or files. To edit a field, choose its new value and confirm.':
      '在虚线区拖入图片或文件、点击选择，或用 Ctrl/Cmd + V 粘贴截图。手机上轻点选择照片或文件。修改字段时选择新值，再确认保存。',
    'Weekly version planning': '安排每周版本',
    'One upcoming Wednesday release is planned automatically. Another plan is created only after the current version is recorded as released.':
      '会自动计划下一个周三的版本；当前版本确认实际发布后，才创建下一版计划。',
    'Tasks that reach On Production in the release window are included automatically. Future work can be selected manually.':
      '本次时间范围内进入 On Production 的 task 会自动包含；未来计划中的工作可以手动选择。',
    'Review the tasks, notes and planned date, then Save plan. After the actual release, review the date (today by default), adjust it if needed, and click Confirm actual release.':
      '检查 task、说明和计划日期，再点击 Save plan。实际发布后核对日期（默认今天），必要时修改，再点击 Confirm actual release。',
    'Open a version to review planned or delivered features, bug fixes and release notes.':
      '打开版本，查看计划或已交付功能、bug 修复和 release notes。',
    'Recording a release updates this tracker; it does not deploy the engineering code. Released records are locked.':
      '确认发布会更新 tracker，不会部署代码。已发布的记录会锁定。',
    'Manage accounts and work groups': '管理账号和 Work groups',
    '+ Add member creates an account with an Admin or Member role. Work groups determine Engineering, QA or Manager access.':
      '点击 + Add member 创建账号，选择 Admin 或 Member Role。Work groups 决定 Engineering、QA 或 Manager 的访问权限。',
    'Edit changes the name, role and work groups. Reset password appears inside Edit after a password has been set.':
      '在 Edit 中修改姓名、Role 和 Work groups。账号已有密码时，Edit 中会显示 Reset password。',
    'Select Management together with a work group to enable My work and Team overview. Choose the Admin system role separately when that person should manage accounts and Activity History. Management alone keeps the viewing-only interface.':
      '同时选择 Management 和工作分组，可切换 My work / Team overview。如需管理账号和 Activity History，另选 Admin Role。只选 Management 时，界面保持只读。',
    'Review the work history': '查看工作历史',
    'Activity History is Admin only. Search by task, person or result to find original actions and timestamps.':
      'Activity History 仅 Admin 可查看。按 task、成员或结果搜索原始操作和时间。',
    'Work history retains earlier actions. Daily Work is the place to edit your own daily entries.':
      'Activity History 保留之前的操作。要编辑自己的每日记录，请进入 Daily Work。',
    'Manage your own password': '修改自己的密码',
    'Open Change password from your account. Enter your current password and confirm a new password of at least 12 characters.':
      '在账号中点击 Change password，输入当前密码，再输入并确认至少 12 个字符的新密码。',
    'After a successful change, sign in again with the new password. On small screens, use the account icon in the top bar.':
      '修改成功后，用新密码重新登录。手机上可从顶部账号图标进入。',
    'Restore this task to continue.': '恢复这个 task 后，即可继续工作。',
    'Task completed. Review the history below.': 'task 已完成，可以在下方查看历史。',
    'This change is on Production. Record your completion check or handoff, then mark the task complete.':
      '变更已上 Production。记录你的完成检查或交接说明，再标记 task 完成。',
    'The engineer has confirmed this change is merged to Stage and ready to test. Test it and record the result. Issues return to Engineering.':
      '工程师已确认变更 merge 到 Stage 并可测试。请进行 QA 并记录结果；有问题则交回 Engineering。',
    'QA passed this Stage build. Deploy to Production, verify the result, then confirm here to include it in the version update.':
      'Stage 版本已通过 QA。部署到 Production 并验证后，在这里确认，计入版本更新。',
    'Review feasibility, choose the engineer and confirm the estimated delivery date.':
      '确认需求是否可完成，选择工程师，并填写预计交付日期。',
    'On hold: engineer cannot complete this request. Revise the scope and review again.':
      '工程师确认暂时无法完成，需求已暂停。调整范围后再确认。',
    'Clarify the request, then confirm feasibility and delivery date.':
      '先明确需求，再确认可行性和交付日期。',
    'Address the QA feedback. Confirm the fixed build is merged to Stage and ready to test, then hand it back to QA in the same step.':
      '先处理 QA 反馈。确认修复后的版本已 merge 到 Stage 并可测试，再在同一步交回 QA。',
    'Continue engineering work. Confirm merged to Stage and assign QA in one step, only when the build is available for testing.':
      '继续开发。只有版本已上 Stage 并可测试时，才确认 merge 到 Stage、选择 QA，完成交接。',
    'Language settings': '语言设置',
    'English is the default. Use 中文 or English in the top bar to switch language when Admin has enabled it for your account. This browser remembers your choice for your account.':
      '默认使用 English。Admin 为你的账号开启语言切换后，可以在顶部选择「中文」或「English」，这个浏览器会按账号记住你的选择。',
    '中文 keeps navigation names, fields, status tags and terms such as Stage in English. Descriptions, tips and examples appear in Chinese.':
      '中文模式保留英文导航、字段、状态 tag 和 Stage 等术语，说明、提示和示例使用中文。',
    'Changing language keeps your drafts, task content, comments and uploaded files unchanged.':
      '切换语言会保留正在输入的内容；task、comment 和上传文件保持原文。',
    'Records saved in database': '记录已保存',
    'No matching tasks': '没有符合条件的 task',
    'No tasks yet': '还没有 task',
    'No archived tasks': '还没有归档 task',
    'No activity logged yet': '还没有工作记录',
    'No history': '还没有历史记录',
    'Activities appear here.': '后续工作记录会显示在这里。',
    'No comments yet.': '还没有 comment。',
    'No images added yet.': '还没有添加图片或文件。',
    'No activity yet': '还没有 activity',
    'All caught up': '暂时没有待处理事项',
    'No private tasks yet': '还没有私人 task',
    'No matching work': '没有符合条件的工作',
    'No matching history': '没有符合条件的历史记录',
    'Email or password is incorrect': '邮箱或密码不正确。',
    'Current password is incorrect': '当前密码不正确。',
    'Use a password with 12–256 characters': '密码需要 12–256 个字符。',
    'Too many attempts. Try again in 15 minutes.': '尝试次数过多，请 15 分钟后再试。',
    'Team overview is read-only': 'Team overview 为只读，请切换到 My work 操作。',
    'Task changed. Refresh it before confirming the next step.':
      'task 已更新，请刷新后再确认下一步。',
    'Choose an active team member': '请选择有效的团队成员。',
    'Choose an estimated delivery date of today or later': '请选择今天或之后的预计交付日期。',
    'Choose the QA owner before confirming Stage': '确认 Stage 前，请先选择 QA owner。',
    'Engineer must confirm this build is on Stage before QA testing':
      '请等待工程师确认这个版本已上 Stage，再进行 QA。',
    'Record an actual test result': '请选择实际测试结果。',
    'Describe what you tested, the issue, or why testing was blocked':
      '请说明测试内容、发现的问题，或无法测试的原因。',
    'Select at least one delivered task': '请至少选择一个已交付 task。',
    'All selected tasks must be On Production or Closed before recording a release':
      '所选 task 全部达到 On Production 或 Closed 后，才能确认实际发布。',
    'Released versions are locked': '已发布版本已锁定。',
    'Request failed': '操作失败，请重试。',
    Saved: '已保存',
    'Activity saved': 'activity 已保存',
    'Comment posted': 'comment 已发布',
    'Work saved': '工作已保存',
    'Work archived': '工作已归档',
    'Work restored': '工作已恢复',
    'Task archived': 'task 已归档。',
    'Task restored': 'task 已恢复',
    'Task removed': 'task 已移除',
    'File uploaded': '文件已上传',
    'Attachment deleted': '附件已删除',
    'Task status updated': 'task 状态已更新',
    'Project status updated': 'project 状态已更新',
    'Also complete task': '同时完成整个 task',
    'Complete this occurrence': '完成本次周期任务',
    'Mark this task complete. Your completion update is recorded under {actor}; the Assignee stays {assignee}.':
      '确认整个 task 已完成。完成说明会记在 {actor} 名下，Assignee 仍为 {assignee}。',
    'Engineering starts. Estimated delivery: {date}.': '开始开发，预计交付日期：{date}。',
    'This build is merged to Stage and available for testing. Next owner: {owner} (QA). QA testing starts after this confirmation.':
      '这个版本已 merge 到 Stage 并可测试。下一步由 {owner}（QA）负责，确认后开始 QA。',
    'Engineering stage: {stage}. QA continues to wait for Stage confirmation.':
      '开发阶段：{stage}。QA 会继续等待工程师确认 Stage。',
    'No activity for {days} working days · Log progress or update the task status.':
      '已有 {days} 个工作日没有 activity，请记录进展或更新 task 状态。',
    'Waiting for {role} to confirm this step.': '等待 {role} 确认这一步。',
    'Assigned to {assignee}. Your update will be recorded as {actor}.':
      'Assignee 为 {assignee}。这次工作记录会记在 {actor} 名下。',
    'Add an activity whenever you work on this task.':
      '每次做了这个 task 的工作，都可以添加一条 activity。',
    'Add an activity whenever you work on this project.':
      '每次做了这个 project 的工作，都可以添加一条 activity。',
    'Archive keeps work and history. Delete removes this {kind} from your workspace.':
      'Archive 保留工作和历史。Delete 会从 workspace 中移除这个 {kind}。',
    'File deleted': '文件已删除。',
    'Files attached': '附件已上传。',
    'Plan saved': '计划已保存。',
    Deleted: '已删除。',
    'Choose a valid first due date': '请选择有效的首次到期日。',
    'Invalid title, type or priority': '请填写标题，并选择有效的 Type 和 Priority。',
    'Engineer must confirm feasibility and delivery first': '请先确认可行性和预计交付日期。',
    'QA must pass the current Stage build before Production':
      '当前 Stage 版本通过 QA 后，才能进入 Production。',
    'Confirm Production deployment before closing the task':
      '完成 task 前，请先确认已部署到 Production。',
    'Only an active task can be completed with an activity':
      '只有未归档的 task 才能通过 activity 标记完成。',
    'Choose a task and a Completed activity result before completing the task':
      '请先选择 task，并将 Activity result 设为 Completed。',
    'Restore archived work before adding or editing activity':
      '请先恢复归档工作，再添加或编辑 activity。',
    'Restore archived work before adding attachments': '请先恢复归档工作，再添加附件。',
    'Restore this archived task before changing it': '请先恢复归档 task，再修改。',
    'Only the uploader or Admin can delete this attachment':
      '只有上传者或 Admin 可以删除这个附件。',
    'Explain what needs clarification or why this cannot be completed':
      '请说明需要澄清什么，或为什么无法完成。',
    'Describe what you confirmed or reported before completing this task':
      '请说明你确认了什么或汇报了什么，再完成 task。',
    'Choose a valid estimated delivery date': '请选择有效的预计交付日期。',
    'Invalid office entry': '请检查工作日期、标题和状态。',
    'Confirm this action before continuing': '请先确认这个操作。',
    'Historical snapshot': '已发布的历史记录',
    'Estimates may change': '预计内容可能调整',
    'Automatically includes tasks moved to On Production from {start} through {end}. Review before recording this release; uncheck and save to exclude. Future work can be selected manually.':
      '自动包含 {start} 至 {end} 进入 On Production 的 task。确认实际发布前请检查；取消勾选并保存即可排除。未来计划可以手动选择。',
    '{features} new features · {fixes} bug fixes · {total} total changes':
      '新增功能 {features} 项 · bug 修复 {fixes} 项 · 共 {total} 项更新',
    'Due {date}. Partial or blocked work counts today; the due reminder stays until this occurrence is completed.':
      '到期日：{date}。可以记录部分进展或 Blocked 情况；完成本次任务前，会继续提醒。',
    'No versions yet': '还没有版本',
    'Plan a version': '先安排一个版本',
    'No tasks selected': '还没有选择 task',
    'No private work yet': '还没有私人工作',
    'Task deleted': 'task 已删除。',
    'Release plan saved': '版本计划已保存。',
    'Task added': 'task 已添加。',
    'Clarify requirements': '明确需求',
    'Review scope': '确认需求范围',
    'Review feasibility': '确认可行性',
    'Fix QA feedback': '修复 QA 反馈',
    'Deploy to Stage': '部署到 Stage',
    'Continue development': '继续开发',
    'Test on Stage': '在 Stage 测试',
    'Confirm Production': '确认 Production',
    'Confirm completion': '确认完成',
    'What did you do?': '你做了什么？',
  };
  copy['Control language switching'] = '管理语言切换';
  copy[
    'In Team Access, open Edit for a member, select Allow language switching and Save record to show their 中文 / English buttons. You can enable it for your own account in the same way.'
  ] =
    '在 Team Access 中点击用户的 Edit，勾选 Allow language switching，再点击 Save record，即可显示该用户的中文 / English 按钮。也可以这样为自己的账号开启。';
  copy[
    'Leave the option unchecked to keep the account in English without a language button. New accounts start with this option off.'
  ] = '不勾选时，该账号使用 English，不显示语言按钮。新账号默认关闭此选项。';
  copy[
    'Off by default. Enable to let this member switch between 中文 and English. Without it, the interface stays in English.'
  ] = '默认关闭。开启后，该用户可以切换中文 / English；关闭时，界面固定使用 English。';
  copy['Invalid language switching option'] = '语言切换选项无效。';
  copy['Complete task'] = '完成 task';
  copy['Check when the whole task is finished. Otherwise, just record your progress.'] =
    '整个 task 都完成时才勾选；否则只需记录工作进展。';
  copy[
    'In Add activity, choose Project itself or one of its tasks, describe your work and attach screenshots. Check Complete task only when the selected task is finished; ordinary activities need no status.'
  ] =
    '在 Add activity 中选择 Project itself 或项目中的 task，填写工作内容并添加截图。选中的 task 全部完成时才勾选 Complete task；普通 activity 不需要选择状态。';
  copy[
    'Record your progress in Add activity without choosing a status. Check Complete task when the entire task is finished, then Save activity; for repeat tasks this ends future reminders.'
  ] =
    '在 Add activity 中直接记录进展，无需选择状态。整个 task 完成时勾选 Complete task，再点击 Save activity；周期 task 的后续提醒也会停止。';
  copy[
    'Daily Work Board lists ongoing tasks. Click a row to open it; click its In Progress, Waiting or Completed tag to change status and confirm.'
  ] =
    'Daily Work Board 显示持续任务。点击一行打开 task；点击 In Progress、Waiting 或 Completed 标签即可选择新状态并确认。';
  copy[
    'Ordinary activity needs only a description, work date and optional attachments. When logging work on a task, check Complete task if the whole task is finished.'
  ] =
    '普通 activity 只需填写工作内容、日期，并按需添加附件。为 task 记录工作时，如果整个 task 已完成，勾选 Complete task。';
  copy[
    'Click a task or project to open its Overview and the ready-to-use Add activity form. Click its status tag to change In Progress, Waiting or Completed, then confirm.'
  ] =
    '点击 task 或 project，即可打开 Overview 和可直接填写的 Add activity 表单。点击状态标签可切换 In Progress、Waiting 或 Completed，再确认。';
  copy[
    'Open an Engineering task to carry out its next step. Open Daily Work tasks to record personal progress.'
  ] = '打开 Engineering task 处理当前步骤；打开 Daily Work task 记录私人工作进展。';
  copy['What needs your attention, and what moved forward.'] = '查看待处理事项和最近的工作进展。';
  copy['Shared tasks, with the next step front and center.'] =
    '共享任务，把下一步需要做的事放在最显眼的位置。';
  copy['Upcoming plans and delivered changes.'] = '查看即将发布的计划和已交付的更新。';
  copy['Describe the request, choose an engineer, and add the details they need to review it.'] =
    '说明需求、选择工程师，并提供评估任务所需的信息。';
  copy['{count} more changes'] = '另有 {count} 项更新';
  copy['No tasks selected. Open the plan to choose Engineering Board tasks.'] =
    '尚未选择 task。打开计划，选择 Engineering Board 中的任务。';
  copy['Select at least one delivered task before confirming a release.'] =
    '请至少选择一个已交付的 task，再确认发布。';
  copy['Selected tasks must be On Production or Closed before confirming the release.'] =
    '选中的 task 必须已处于 On Production 或 Closed，才能确认发布。';
  copy['Choose the actual release date.'] = '请选择真实发布日期。';
  copy['Ready to record this release.'] = '已满足条件，可以记录这次发布。';
  copy[
    'Use All tasks, Engineering, Ready for QA or Production to focus the board. Active and Archived switch its scope; Cards and List show the same tasks and open the same details. Open Filters for category, development, QA progress and sorting; remove a chip or use Clear all to reset filters.'
  ] =
    '使用 All tasks、Engineering、Ready for QA 或 Production 查看相应阶段。Active / Archived 切换范围；Cards / List 展示相同任务并打开同一详情。Filters 可按分类、开发阶段、QA 进度筛选和排序；移除筛选标签或点击 Clear all 清空。';
  copy[
    'Each version card previews its date and changes. Open Review plan or View details to see the full version; click a task title to open its Engineering details.'
  ] =
    '版本卡片会预览日期和更新内容。点击 Review plan 或 View details 查看完整版本；点击 task 标题可打开 Engineering 详情。';
  copy[
    'Click Review plan, choose tasks, edit notes and the planned date, then Save plan. After the actual release, check the actual date (today by default) and click Confirm actual release. The message beside the button explains any remaining requirements.'
  ] =
    '点击 Review plan，选择 task、修改备注和计划日期，再点击 Save plan。实际发布后，检查真实发布日期（默认今天），点击 Confirm actual release；按钮旁会提示还需要满足的条件。';
  copy[
    'Cards highlight the next step and show its owner beside the avatar. Switch to List to see Assignee and the last Engineering / QA dates. Open the task to carry out its step; Daily Engineering Activity shows dated work.'
  ] =
    'Cards 突出下一步，头像旁显示下一步负责人。切换 List 可查看 Assignee 和最近的 Engineering / QA 日期。打开 task 可执行当前步骤；Daily Engineering Activity 显示当天工作。';
  copy['Add reference images or files now. Each file can be up to 8 MB.'] =
    '可以直接添加参考图片或文件；每个文件最大 8 MB。';
  copy[
    'Task created. Some files could not upload. Retry uploads to attach the remaining files without creating another task.'
  ] = 'task 已创建，部分附件上传失败。点击 Retry uploads 重试剩余文件，不会重复创建 task。';
  copy[
    'In New task, add images or files in the dashed Attachments area before clicking Create task. Drop files, click to choose, or paste a screenshot; on a phone, tap the area. Remove a selected file with ×. If an upload fails, click Retry uploads.'
  ] =
    '在 New task 的 Attachments 虚线区域添加图片或文件，再点击 Create task。可拖拽文件、点击选择或粘贴截图；手机上点击该区域。点击 × 移除已选文件；上传失败时点击 Retry uploads。';
  copy[
    'Use Cards / List at the top to switch the layout. Select All tasks, Engineering, Ready for QA or Production to focus the board; select All tasks to reset the stage. Open Filters for category, development, QA progress and sorting; remove a chip or use Clear all to reset filters.'
  ] =
    '使用顶部 Cards / List 切换布局。选择 All tasks、Engineering、Ready for QA 或 Production 查看相应阶段；选择 All tasks 重置阶段。Filters 提供分类、开发阶段、QA 进度和排序；移除筛选标签或点击 Clear all 清空筛选。';
  copy[
    'Click a task to open it. Active shows unfinished tasks; Completed shows finished tasks. Archived stores tasks with their history and can include unfinished work. Archiving does not complete a task.'
  ] =
    '点击 task 打开详情。Active 显示未完成任务；Completed 显示已完成任务；Archived 保留任务和历史，也可能包含未完成的工作。归档不会将 task 标记为完成。';
  copy[
    'Choose All team, Related to me, Needs my action or Unassigned above the board. Related to me includes requests you created and tasks where you are Engineering or QA owner; Needs my action focuses on your current step.'
  ] =
    '在看板上方选择 All team、Related to me、Needs my action 或 Unassigned。Related to me 包含你创建的需求，以及你负责 Engineering 或 QA 的任务；Needs my action 只显示当前需要你处理的步骤。';
  copy[
    'Use All team or Unassigned above the board to review task ownership. Viewing does not assign a task.'
  ] = '在看板上方选择 All team 或 Unassigned 查看任务分配情况。查看不会改变任务负责人。';
  copy[
    'Open an unassigned request and choose yourself as Engineer during review. Confirm feasibility and the delivery date to start development.'
  ] = '打开未分配的需求，在 review 中将 Engineer 选为自己。确认可完成及预计交付日期后开始开发。';
  copy[
    'One upcoming version is kept at a time. Set its name and planned date; the next plan opens after actual release.'
  ] = '一次保留一个待发布版本。可以设置版本名和计划日期；确认实际发布后，再生成下一版计划。';
  copy[
    'Click Plan version or Review plan, set the version name and planned date, choose tasks and edit notes, then Save plan. After the actual release, check the actual date (today by default) and click Confirm actual release. The message beside the button explains any remaining requirements.'
  ] =
    '点击 Plan version 或 Review plan，设置版本名和计划日期，选择 task 并填写备注，再点击 Save plan。实际发布后，检查真实发布日期（默认今天），点击 Confirm actual release；按钮旁会提示尚未满足的条件。';
  copy['No completed tasks'] = '还没有已完成的 task。';
  copy['Tasks appear here after Confirm task complete.'] =
    '确认 Confirm task complete 后，task 会显示在这里。';
  copy['No active tasks'] = '目前没有未完成的 task。';
  copy['Completed tasks are in Completed. Stored tasks are in Archived.'] =
    '已完成任务可在 Completed 查看，归档任务可在 Archived 查看。';
  copy['Version name is required'] = '请填写版本名。';
  copy['Version already exists'] = '这个版本名已被使用。';
  copy['Choose the planned release date'] = '请选择计划发布日期。';
  copy['e.g. v1.2.0'] = '例如 v1.2.0';
  copy['Only this occurrence is completed. The next repeat stays active.'] =
    '只完成当前这一次，下一次周期任务会继续提醒。';
  copy['Occurrence completed; next repeat remains active'] = '本次已完成，下一次周期任务继续保留。';
  copy['Update completion date'] = '修改完成日期';
  copy['This date belongs to the task. Activity work dates stay separate.'] =
    '这个日期属于 task；activity 的工作日期单独保留。';
  copy['Completion date updated'] = '完成日期已更新。';
  copy['Choose a valid completion date'] = '请选择有效的完成日期。';
  copy['Complete the task before setting its completion date'] =
    '请先完成 task，再设置它的完成日期。';
  copy['This occurrence has changed. Refresh the task before completing it.'] =
    '本次周期已发生变化。请刷新 task 后再确认，避免重复完成。';
  copy[
    'Record your progress in Add activity. For a one-off task, choose Complete task when it is finished. For repeating work, choose Complete this occurrence; future repeats remain active.'
  ] =
    '在 Add activity 记录进展。一次性 task 完成时选择 Complete task；周期性工作选择 Complete this occurrence，后续周期继续保留。';
  copy[
    'Click the status tag and choose Complete this occurrence for repeating work. Confirm its completion date to advance the next reminder. Use Edit task → Repeat → Does not repeat or Archive task to stop future repeats.'
  ] =
    '周期性工作可点击状态标签，选择 Complete this occurrence，确认完成日期后安排下一次提醒。需要停止周期时，使用 Edit task → Repeat → Does not repeat，或 Archive task。';
  copy[
    'Set Completed date when marking a task Completed, or click its date in Overview to correct it. Activity work dates are separate. Completed tasks stay out of new Activity belongs to lists.'
  ] =
    '标记 Completed 时设置 Completed date，也可在 Overview 点击日期修改。activity 的日期单独记录；新的 Activity belongs to 列表不显示已完成 task。';
  copy[
    'In Add activity, choose Project itself or one of its unfinished tasks, describe your work and attach screenshots. Complete task finishes a one-off task; Complete this occurrence finishes only the current repeat.'
  ] =
    '在 Add activity 选择 Project itself 或未完成的 task，填写工作并添加截图。Complete task 完成一次性任务；Complete this occurrence 只完成当前周期。';
  copy[
    'Completed date belongs to the task. It is shown after completion and can be corrected from the date beside Overview; Activity timeline keeps its own work dates.'
  ] =
    'Completed date 属于 task，完成后会显示，也可点击日期修改；Activity timeline 保留每条记录自己的工作日期。';
  copy['View Completed date on finished tasks. Activity timeline keeps the separate work dates.'] =
    '查看已完成 task 的 Completed date；Activity timeline 保留各条记录的工作日期。';
  copy[
    'Set Completed date when confirming completion. Click the date in task details to correct it; Activity timeline keeps its own work dates.'
  ] =
    '确认完成时设置 Completed date。需要修改时点击详情中的日期；Activity timeline 保留各条工作记录的日期。';
  copy[
    'Use + Activity for work you did today. Choose Task for ongoing work. For an already finished task, choose Completed and set its Completed date.'
  ] =
    '通过 + Activity 记录当天工作，持续工作选择 Task。添加已完成 task 时，选择 Completed 并设置 Completed date。';
  copy['Activity and follow-up work'] = 'Activity 与后续工作';
  copy[
    'Read Activity as work someone already did. Task status shows what still needs follow-up; Engineering results describe the test or deployment.'
  ] =
    'Activity 展示员工已经做过的工作；Task 状态表示还需要跟进什么，Engineering 结果说明测试或部署情况。';
  copy[
    'Use Activity to record what you did, with a work date and optional files. Choose Task for work that needs a next action or continued follow-up.'
  ] = '用 Activity 记录已做的工作、日期和附件；需要下一步行动或持续跟进的工作选择 Task。';
  copy[
    'Record progress under its Task. Use the task status tag or Complete task when a one-off task is finished; use Complete this occurrence for repeating work. Activity history shows your actions, while Task overview shows its current status.'
  ] =
    '在对应 Task 下记录进展。一次性任务完成时，使用状态标签或 Complete task；周期任务使用 Complete this occurrence。Activity history 查看每次行动，Task overview 查看当前状态。';
  copy['Each entry records the work date, details and attachments.'] =
    '每条记录包含工作日期、具体内容和附件。';
  copy['Your profile photo'] = '个人头像';
  copy[
    'Open My account by clicking your avatar or the account icon. Drop a photo in the upload area, tap to choose one, or paste an image. It appears beside your name in the workspace.'
  ] =
    '点击头像或 account 图标打开 My account。在上传区域拖入照片、点击选择或粘贴图片；头像会显示在工作区姓名旁。';
  copy[
    'Upload another photo to replace it. Remove photo returns to your initials. Change password opens the password form below your account details.'
  ] =
    '上传新的照片即可更换头像；Remove photo 恢复姓名缩写。点击 Change password 打开修改密码表单。';
  copy['Tap or click to choose a photo, or drop it here.'] = '点击选择头像，或将照片拖到这里。';
  copy['PNG, JPG, WebP or GIF, up to 8 MB. You can also paste an image with Ctrl/Cmd + V.'] =
    '支持 PNG、JPG、WebP 或 GIF，最大 8 MB；也可以使用 Ctrl/Cmd + V 粘贴图片。';
  copy['Choose a photo up to 8 MB'] = '请选择不超过 8 MB 的照片。';
  copy['Choose a PNG, JPG, WebP or GIF image'] = '请选择 PNG、JPG、WebP 或 GIF 图片。';
  copy['This photo could not be opened. Choose another image.'] =
    '这张照片无法打开，请选择另一张图片。';
  copy['Uploading photo…'] = '正在上传头像…';
  copy['Removing photo…'] = '正在移除头像…';
  copy['Photo updated'] = '头像已更新。';
  copy['Photo removed'] = '头像已移除。';
  copy['You can change only your own avatar'] = '只能修改自己的头像。';
  copy['Version plans and releases'] = '版本计划与发布';
  copy[
    'Choose Engineering owner from Engineering members and QA owner from QA members. If an existing owner shows unavailable, choose another member. Admin users need the corresponding Work group to appear in these lists.'
  ] =
    'Engineering owner 请选择 Engineering 成员，QA owner 请选择 QA 成员。已有负责人显示 unavailable 时，请重新选择。Admin 也需要属于对应 Work group，才能出现在负责人列表中。';
  copy['Choose an active Engineering member'] = '请选择有效的 Engineering 成员。';
  copy['Choose an active QA member'] = '请选择有效的 QA 成员。';
  copy[
    'Next release is the current plan. Planned release cards show later plans, including versions scheduled for next month.'
  ] = 'Next release 是当前待发布版本。Planned release 展示之后的计划，也可以提前安排下个月的版本。';
  copy[
    'Click + Plan to add a future version with its name, planned date and notes. Open Review plan to choose tasks, then Save plan. Later plans stay available while the current version is unfinished.'
  ] =
    '点击 + Plan，填写未来版本的名称、计划日期和备注。打开 Review plan 选择 task，再点击 Save plan。当前版本未发布时，也可以保留之后的计划。';
  copy[
    'In Include Engineering Board tasks, Ready for release shows On Production or Closed tasks. Not ready shows work still in development or QA. Tasks already selected in another version show that version name.'
  ] =
    '在 Include Engineering Board tasks 中，Ready for release 是 On Production 或 Closed 的任务；Not ready 是仍在开发或 QA 的任务。其他版本已选择的任务会显示对应版本名。';
  copy[
    'After the actual release, check the actual date (today by default) and click Confirm actual release. Review the confirmation: ready tasks enter this release, and selected unfinished tasks move to the next plan. At least one ready task is required.'
  ] =
    '实际发布后，检查真实发布日期（默认今天），点击 Confirm actual release。确认窗口会列出本次更新和顺延任务：已上线的任务进入本次版本，未完成的任务移到下一版。至少需要一个已上线的任务。';
  copy[
    'The next Wednesday plan opens after the current version is released. If you already planned that next version, open its card to continue.'
  ] = '当前版本发布后，可以继续下一次周三的计划；如果已提前创建下一版，打开对应卡片继续填写。';
  copy[
    'Open a version to review planned or delivered features, bug fixes and release notes. Unfinished tasks appear in the next plan rather than the delivered changes.'
  ] =
    '打开版本查看计划或已发布的功能、bug 修复和备注。未完成的任务会出现在下一版计划中，不计入本次更新。';
  copy[
    'Schedule a future version, including next month. You can choose its tasks after creating the plan.'
  ] = '可以提前安排未来版本，包括下个月；创建后再选择对应 task。';
  copy['e.g. Improve search and fix the sign-in issue.'] = '例如：改进搜索，修复登录问题。';
  copy['Version plan created'] = '版本计划已创建。';
  copy[
    'Keep future plans here. The next Wednesday plan opens after the current version is released.'
  ] = '这里可以提前安排未来版本；当前版本发布后继续下一次周三的计划。';
  copy['Use + Plan to schedule a version.'] = '点击 + Plan 安排版本。';
  copy['Select at least one task that is On Production or Closed.'] =
    '请选择至少一个 On Production 或 Closed 的 task。';
  copy['Select at least one task that is On Production or Closed'] =
    '请选择至少一个 On Production 或 Closed 的 task。';
  copy['Ready tasks enter this release. Selected unfinished tasks move to the next plan.'] =
    '已上线任务进入本次版本；选中的未完成任务顺延到下一版。';
  copy['On Production or Closed. Selected tasks enter the released changes.'] =
    'On Production 或 Closed：选中后计入本次版本更新。';
  copy[
    'Still in development or QA. Selected tasks move to the next plan when this version is released.'
  ] = '仍在开发或 QA：本次发布时，选中的任务会顺延到下一版。';
  copy['Remove a task from its current plan before selecting it here.'] =
    '先从原计划中取消选择，再加入当前版本。';
  copy['Selected in {version}'] = '已加入 {version}';
  copy['All available tasks are already in released versions.'] =
    '目前可用的 task 都已计入已发布版本。';
  copy['{count} unfinished tasks moved to {version}.'] = '{count} 个未完成任务已顺延至 {version}。';
  copy[
    'Automatically includes tasks moved to On Production from {start} through {end}. Tasks reserved for future plans stay in those plans. Uncheck and save to exclude.'
  ] =
    '自动纳入 {start} 至 {end} 期间上 Production 的任务。已选入未来版本的任务会保留在原计划中；取消勾选并保存即可排除。';
  copy[
    'Select both delivered and planned work. Confirming a release includes only On Production or Closed tasks and carries unfinished tasks to the next plan.'
  ] =
    '可以选择已上线和计划中的工作。确认发布时，只将 On Production 或 Closed 的任务计入本次更新，其余任务顺延到下一版。';
  copy['Release recorded. Unfinished tasks moved to the next plan.'] =
    '发布记录已保存，未完成任务已顺延到下一版。';
  copy[
    'These tasks remain unfinished and move to the next version plan. A next Wednesday plan is created if needed.'
  ] = '这些任务保持未完成，并移到下一版计划；需要时会创建下一次周三的计划。';
  copy['Release plan changed. Refresh it before saving.'] = '版本计划已被修改，请刷新后再保存。';
  copy['Release plan or task changed. Refresh it before confirming.'] =
    '版本计划或 task 已被修改，请刷新后再确认。';
  copy['Release plan or task selection changed. Refresh it before saving.'] =
    '版本计划或任务选择已被修改，请刷新后再保存。';
  const escape = (text) =>
    String(text ?? '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );
  copy['e.g. Inventory'] = '例如 Inventory';
  copy['Enter a category name'] = '请输入 Category 名称。';
  copy['Category name must be 1–80 characters'] = 'Category 名称需要 1–80 个字符。';
  copy['Category added'] = 'Category 已添加。';
  copy['Task categories'] = 'Task 分类';
  copy['{done} of {total} tasks complete'] = '已完成 {done} / {total} 个 task';
  copy[
    'Cards and List open the same Engineering task details. Filters and sorting apply in either layout.'
  ] = 'Cards 和 List 都打开原来的 Engineering task 详情；筛选和排序在两种布局下都可使用。';
  copy[
    'Category tags identify each shared task. Use Filters → Category to show tasks in one category.'
  ] = 'Category 标签显示每个共享 task 的分类。使用 Filters → Category 查看一个分类的 task。';
  copy[
    'In a new task or Task details & PR, open Category and choose + Add category. Enter its name and click Add category; existing categories can be reused.'
  ] =
    '在新建 task 或 Task details & PR 中打开 Category，选择 + Add category，输入名称并点击 Add category；已有分类可以重复使用。';
  copy[
    'Category appears as a colored tag in the task list. Use Filters → Category to show only that category.'
  ] = 'task 列表用柔和颜色的标签显示 Category。使用 Filters → Category 筛选分类。';
  copy[
    'Order numbers are hidden in the task list. Use Sort by → Manual order to apply the existing task order.'
  ] = 'task 列表不显示 Order 数字。使用 Sort by → Manual order 按已有顺序排序。';
  let language = 'en',
    account = '',
    allowed = false;
  const storageKey = () => 'work-tracker.language.account.' + encodeURIComponent(account);
  function configure(user) {
    const nextAccount = String(user?.email || ''),
      nextAllowed = !!nextAccount && Number(user?.language_switch_enabled) === 1;
    if (nextAccount !== account || nextAllowed !== allowed) {
      account = nextAccount;
      allowed = nextAllowed;
      language = 'en';
      if (allowed)
        try {
          if (localStorage.getItem(storageKey()) === 'zh') language = 'zh';
        } catch {}
    }
    apply();
  }
  const translate = (text, values = {}) =>
    (language === 'zh' ? (copy[text] ?? String(text ?? '')) : String(text ?? '')).replace(
      /\{(\w+)\}/g,
      (all, key) => (Object.hasOwn(values, key) ? String(values[key]) : all),
    );
  const html = (text, values = {}) =>
    Object.hasOwn(copy, text)
      ? '<span data-ui="' +
        escape(text) +
        '" data-ui-values="' +
        escape(JSON.stringify(values)) +
        '">' +
        escape(translate(text, values)) +
        '</span>'
      : escape(translate(text, values));
  const reverse = new Map(Object.entries(copy).map(([en, zh]) => [zh, en]));
  function apply(root = document) {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
    for (const node of root.querySelectorAll('[data-ui]')) {
      let values = {};
      try {
        values = JSON.parse(node.dataset.uiValues || '{}');
      } catch {}
      node.textContent = translate(node.dataset.ui, values);
    }
    for (const node of root.querySelectorAll('[placeholder]')) {
      const key =
        node.dataset.uiPlaceholder ||
        reverse.get(node.getAttribute('placeholder')) ||
        node.getAttribute('placeholder');
      if (Object.hasOwn(copy, key)) {
        node.dataset.uiPlaceholder = key;
        node.setAttribute('placeholder', translate(key));
      }
    }
    for (const control of document.querySelectorAll('.language-switch')) control.hidden = !allowed;
    for (const button of document.querySelectorAll('[data-language]')) {
      button.disabled = !allowed;
      const active = button.dataset.language === language;
      button.classList.toggle('selected', active);
      button.setAttribute('aria-pressed', String(active));
    }
  }
  function set(value) {
    if (!allowed || !['zh', 'en'].includes(value)) return;
    language = value;
    try {
      localStorage.setItem(storageKey(), value);
    } catch {}
    apply();
  }
  globalThis.WorkTrackerLanguage = {
    translate,
    html,
    apply,
    set,
    configure,
    get current() {
      return language;
    },
  };
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-language]');
    if (button) set(button.dataset.language);
  });
  apply();
})();
