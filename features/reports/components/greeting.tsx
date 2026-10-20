/** The big two-line hello at the top of the dashboard. */
export function Greeting({ name, line, description }: { name: string; line: string; description: string }) {
  const firstName = name.split(/\s+/)[0];
  return (
    <div className="flex flex-col justify-center py-2">
      <h1 className="text-4xl leading-[1.15] font-bold tracking-tight sm:text-[2.6rem]">
        Hi, {firstName}!
        <br />
        <span className="text-primary">{line}</span>
      </h1>
      <p className="mt-4 max-w-md text-base text-muted-foreground">{description}</p>
    </div>
  );
}
