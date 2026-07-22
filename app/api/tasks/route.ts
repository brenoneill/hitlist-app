import { addTask, listTasks } from "@/app/lib/tasks";

export async function GET() {
  return Response.json(await listTasks());
}

export async function POST(request: Request) {
  const { title, repoUrl } = await request.json();
  if (typeof title !== "string" || !title.trim()) {
    return Response.json({ error: "title required" }, { status: 400 });
  }
  if (typeof repoUrl !== "string" || !repoUrl.trim()) {
    return Response.json({ error: "repoUrl required" }, { status: 400 });
  }
  return Response.json(
    await addTask(title.trim(), repoUrl.trim()),
    { status: 201 },
  );
}
