import { Queue } from "bullmq";
import IORedis from "ioredis";

const q = new Queue("open-director-render", {
  connection: new IORedis({
    host: "localhost",
    port: 6379,
    maxRetriesPerRequest: null,
  }),
});

const job = await q.add("test", {
  title: "A Sabedoria da Flexibilidade",
  items: [
    {
      audio: [
        {
          url: "https://d8w80sv4xvjp1.cloudfront.net/voices/1777735816618949082_0f2f1b037953a3fa_a010fd7765264ec39c8ce48a61b50e63_1.mp3",
          text: "No coração de uma floresta serena",
          duration: 7.38,
        },
      ],
      image: {
        url: "https://d8w80sv4xvjp1.cloudfront.net/images/1777735831491942951_3d1e32e8889f69e9_5e5b1860f92f48229cb709ea909dd7ae_d8556617-6880-463d-952c-41ab7dac0641.jpeg",
      },
      sub_title: {
        text: "No coração de uma floresta serena",
      },
    },
    {
      audio: [
        {
          url: "https://d8w80sv4xvjp1.cloudfront.net/voices/1777735816596557599_19c265c96a2bd92c_954f05a52286491c84ceb6b335f7557d_1.mp3",
          text: "Ele desprezava o bambu esguio",
          duration: 5.8,
        },
      ],
      image: {
        url: "https://d8w80sv4xvjp1.cloudfront.net/images/1777735831504551892_72e067f245efd24b_9575f07599da4568afc8a96657a45b3d_61601bd5-4b61-4a4a-adb7-d1d74b3895ca.jpeg",
      },
      sub_title: {
        text: "Ele desprezava o bambu esguio",
      },
    },
  ],
  aspect_ratio: "9:16",
  resolution: 480,
  isFreeUser: true,
});

console.log("Job created:", job.id);
await q.close();
