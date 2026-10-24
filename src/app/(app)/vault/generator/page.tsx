import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page";
import { PasswordGenerator } from "@/components/vault/password-generator";

export default function GeneratorPage() {
  return (
    <>
      <PageHeader title="Password Generator" description="Create strong, random passwords and passphrases. Generated locally in your browser." />
      <Card className="max-w-xl shadow-xs">
        <CardHeader>
          <CardTitle>Generate</CardTitle>
          <CardDescription>Uses your browser&apos;s cryptographically secure random number generator.</CardDescription>
        </CardHeader>
        <CardContent>
          <PasswordGenerator />
        </CardContent>
      </Card>
    </>
  );
}
