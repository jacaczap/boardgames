import { useLocalSearchParams } from "expo-router";
import { Center } from "@/components/ui/center";
import { Spinner } from "@/components/ui/spinner";
import SurveyContent from "@/components/SurveyContent";

export default function SurveyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  if (!id) {
    return (
      <Center className="flex-1 bg-stone-50">
        <Spinner />
      </Center>
    );
  }

  return <SurveyContent meetingId={id} />;
}
