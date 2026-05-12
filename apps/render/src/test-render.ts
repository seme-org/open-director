import { prepareAssets } from "./asset-processor.js";
import { determineCanvasSize } from "./asset-processor.js";
import type { RenderJobInput } from "./types.js";

const input: RenderJobInput = {
  threadId: "0b9efc4d-e80e-4806-9526-8575428acd33",
  messageId: "msg_test_001",
  userId: "cmoogr4oa0081n4ckrcqw2kbc",
  title: "A Sabedoria da Flexibilidade",
  isFreeUser: true,
  resolution: 480,
  aspect_ratio: "9:16",
  items: [
    {
      audio: [
        {
          url: "https://d8w80sv4xvjp1.cloudfront.net/voices/1777735816618949082_0f2f1b037953a3fa_a010fd7765264ec39c8ce48a61b50e63_1.mp3",
          text: "No coração de uma floresta serena, um carvalho majestoso exibia sua força inabalável.",
          duration: 7.38,
        },
      ],
      image: {
        url: "https://d8w80sv4xvjp1.cloudfront.net/images/1777735831491942951_3d1e32e8889f69e9_5e5b1860f92f48229cb709ea909dd7ae_d8556617-6880-463d-952c-41ab7dac0641.jpeg",
      },
      sub_title: {
        text: "No coração de uma floresta serena, um carvalho majestoso exibia sua força inabalável.",
      },
    },
    {
      audio: [
        {
          url: "https://d8w80sv4xvjp1.cloudfront.net/voices/1777735816596557599_19c265c96a2bd92c_954f05a52286491c84ceb6b335f7557d_1.mp3",
          text: "Ele desprezava o bambu esguio que balançava humildemente ao seu lado.",
          duration: 5.796,
        },
      ],
      image: {
        url: "https://d8w80sv4xvjp1.cloudfront.net/images/1777735831504551892_72e067f245efd24b_9575f07599da4568afc8a96657a45b3d_61601bd5-4b61-4a4a-adb7-d1d74b3895ca.jpeg",
      },
      sub_title: {
        text: "Ele desprezava o bambu esguio que balançava humildemente ao seu lado.",
      },
    },
    {
      audio: [
        {
          url: "https://d8w80sv4xvjp1.cloudfront.net/voices/1777735816612619314_adf99a54003f73d2_85e44d108f5a4b8e94345bdfd0bdd9df_1.mp3",
          text: "Para o carvalho, ser forte significava nunca ceder.",
          duration: 5.328,
        },
      ],
      image: {
        url: "https://d8w80sv4xvjp1.cloudfront.net/images/1777735826489114350_c72cddf7aaabcd0f_4cfd5ba5cad3416395683544af6d704d_010661f7-11cc-4bff-b7e4-a06a0ca935e1.jpeg",
      },
      sub_title: {
        text: "Para o carvalho, ser forte significava nunca ceder.",
      },
    },
  ],
  bg_audios: [
    {
      url: "https://wui-aiproxy-gen-demo.s3.us-west-1.amazonaws.com/voices/1777735884359092573_888bafe61086881f_e9de61f6a6a942bf95d921e84b7b74d7_0_01fc2e4b-ba3d-4e79-9a0c-85df3c602932-u2_c221cbc7-c420-4a5f-aa3a-d78273a25ff7.mp3",
      volume: 0.15,
    },
  ],
  input_parameter: {
    advancedParameters: {
      isGenerateTransition: "yes",
      isGenerateVideoEffect: "yes",
      isGenerateSubtitle: "yes",
      isGenerateTitleAnimation: "yes",
      isGenerateSubtitleAnimation: "yes",
      titleAnimation: "backInDown",
      subtitleAnimation: "fadeInUp",
      titleStyle:
        '{"fontFamily":"Sarasa UI SC","fontSize":80,"color":"#FFFF00","stroke":"#000000","strokeThickness":6}',
      subtitleStyle:
        '{"fontFamily":"Sarasa UI SC","fontSize":50,"color":"#FFD700","stroke":"#000000","strokeThickness":8}',
      videoEffectStyle: '{"name":"mini_zoom"}',
      transitionStyle: '{"name":"CrossZoom","duration":1}',
    },
  },
};

async function main() {
  const taskId = `test_${Date.now()}`;
  console.log(`[Test] Starting asset preparation: ${taskId}`);
  console.log(`[Test] Items: ${input.items.length}, BgAudios: ${input.bg_audios?.length}`);
  console.log(`[Test] Resolution: ${input.resolution}, Aspect: ${input.aspect_ratio}`);

  const start = Date.now();

  const { processedItems, tempFiles, bgAudios } = await prepareAssets(
    input.items,
    input.bg_audios,
    input.narration_audio,
    taskId,
  );

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n[Test] Asset preparation completed in ${elapsed}s`);
  console.log(`[Test] Processed items: ${processedItems.length}`);
  console.log(`[Test] Temp files: ${tempFiles.length}`);
  console.log(`[Test] Bg audios: ${bgAudios.length}`);

  for (const [i, item] of processedItems.entries()) {
    console.log(`\n  [Item ${i}]`);
    console.log(`    image: ${item.imagePath ?? "none"}`);
    console.log(`    audio: ${item.audioPath ?? "none"}`);
    console.log(`    audioSpeed: ${item.audioSpeed?.toFixed(2) ?? "none"}x`);
    console.log(`    probedVideoDuration: ${item.probedVideoDuration?.toFixed(2) ?? "N/A"}s`);
    console.log(`    probedAudioDuration: ${item.probedAudioDuration?.toFixed(2) ?? "N/A"}s`);
    console.log(`    probedResolution: ${item.probedWidth ?? "?"}x${item.probedHeight ?? "?"}`);
  }

  console.log(`\n[Test] Determining canvas size...`);
  const { width, height } = determineCanvasSize(
    processedItems,
    input.aspect_ratio,
    taskId,
    input.resolution,
  );
  console.log(`[Test] Canvas: ${width}x${height}`);

  console.log(`\n[Test] PASSED`);
}

main().catch((err) => {
  console.error("[Test] FAILED:", err);
  process.exit(1);
});
