/**
 * This is an example client for FaceQuest face verification services
 *
 */

const axios = require('axios');


const FACEQUEST_REGISTERED_EMAIL = "myemail@example.com"
const FACEQUEST_SECRET = "my_super_top_secret"

const REFERENCE_PHOTO_FILE_LOCATION = "./reference_photo.jpg"
const PHOTO_TO_BE_VALIDATED_FILE_LOCATION = "./photo_to_be_verified.jpg"
const TITLE_OF_VERIFICATION_JOB = "Verification of User 2345"
const NOTES_FOR_VERIFICATION = "This is triggerred as a part of our regular user verification with Aadhaar card"


const HEADER_DEFINITION = {
  headers: {
    authorizationtoken: 'bearer', // Note this constant value 'bearer'. Dont change it
    secret: FACEQUEST_SECRET,
    email: FACEQUEST_REGISTERED_EMAIL
  }
};

class FaceQuestClient {

  constructor() {
    this.uploadUrls = undefined;
    this.verificationRequestId = undefined;

  }

  async main() {
    await this.getUrlsToUploadPhotos();

    await this.uploadReferenceFacePhoto();

    await this.uploadPhotoToBeValidated();

    await this.fireVerificationRequest();

    //poll for results
    this.pollingTimer = setInterval(this.checkIfVerificationCompleted.bind(this), 3000);
  }


  async getUrlsToUploadPhotos() {
    await axios.get(
        "https://verifyapi.facequest.io/api/v1/verification/uploadurl",
        HEADER_DEFINITION
      )
      .then((response) => {
        console.log("Received upload url data: \n" + this.prettyPrint(response.data))
        this.uploadUrls = response.data;
      })
      .catch((err) => {
        console.error("Error fetching upload URLs - " + err);
      });
  }


  async uploadReferenceFacePhoto() {
    var referenceFaceUploadUrl = this.uploadUrls.data.referenceFace.uploadUrl;
    await axios.put(referenceFaceUploadUrl, REFERENCE_PHOTO_FILE_LOCATION).then((response) => {
      console.log("Successfully uploaded reference face photo")
    });
  }

  async uploadPhotoToBeValidated() {
    var givenFaceUploadUrl = this.uploadUrls.data.faceToBeValidated.uploadUrl;
    await axios.put(givenFaceUploadUrl, PHOTO_TO_BE_VALIDATED_FILE_LOCATION).then((response) => {
      console.log("Successfully uploaded photo to be validated")
    });
  }

  async fireVerificationRequest() {
    const body = {
      title: TITLE_OF_VERIFICATION_JOB,
      notes: NOTES_FOR_VERIFICATION,
      referenceFaceFilePath: this.uploadUrls.data.referenceFace.filePath,
      givenFaceFilePath: this.uploadUrls.data.faceToBeValidated.filePath
    }
    const self = this;
    await axios.post(
        "https://verifyapi.facequest.io/api/v1/verification",
        body,
        HEADER_DEFINITION
      )
      .then((response) => {
        console.log("Verification triggered. Response: \n" + self.prettyPrint(response.data));
        self.verificationRequestId = response.data.verificationRequestId;
        console.log("Request id - " + self.verificationRequestId)
      })
      .catch((err) => {
        console.log("Error firing verification request:\n" + self.prettyPrint(err));
      });
  }


  async checkIfVerificationCompleted() {
    const self = this;
    axios
      .get(
        "https://verifyapi.facequest.io/api/v1/verification/" + self.verificationRequestId,
        HEADER_DEFINITION
      )
      .then((response) => {
        if (response.data.result === "PENDING") {
          console.log("Result is pending. Will retry again...")
        } else {
          console.log("Verification complete. Response is :\n" + self.prettyPrint(response.data));
          self.stopPolling();
        }
      })
      .catch((err) => {
        console.error("Error while polling for result: \n" + err)
      });
  }

  stopPolling() {
    clearInterval(this.pollingTimer);
    this.pollingTimer = null;
  }

  prettyPrint(json) {
    return JSON.stringify(json, null, 2)
  }
}

new FaceQuestClient().main();
