/**
 * This is an example client for FaceQuest face verification services
 *
 */

const axios = require('axios');
const fs = require('fs');

const FACEQUEST_REGISTERED_EMAIL = "email@example.com"
const FACEQUEST_SECRET = "my_super_secret"

const REFERENCE_PHOTO_FILE_LOCATION = "./reference_photo.jpg"
const PHOTO_TO_BE_VERIFIED_FILE_LOCATION = "./photo_to_be_verified.jpg"
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

    await this.uploadPhotoToBeVerified();

    await this.fireVerificationRequest();

    //poll for results
    this.pollingTimer = setInterval(this.checkIfVerificationCompleted.bind(this), 5000);
  }


  async getUrlsToUploadPhotos() {
    var self = this;
    await axios.get(
        "https://verifyapi.facequest.io/api/v1/verification/uploadurl",
        HEADER_DEFINITION
      )
      .then((response) => {
        console.log("Received upload url data: \n" + self.prettyPrint(response.data))
        self.uploadUrls = response.data;
      })
      .catch((err) => {
        console.error("Error fetching upload URLs - " + self.prettyPrint(err));
      });
  }


  async uploadReferenceFacePhoto() {
    var self = this;
    var referencePhotoUploadUrl = this.uploadUrls.data.referenceFace.uploadUrl;

    fs.readFile(REFERENCE_PHOTO_FILE_LOCATION, async (err, data) => {
      if (err) throw err;
      var config = {
        method: 'put',
        url: referencePhotoUploadUrl,
        data: data
      };
      await axios(config)
        .then(function(response) {
          console.log("Successfully uploaded reference photo");
        })
        .catch(function(error) {
          console.log(error);
        });
    });
  }

  async uploadPhotoToBeVerified() {
    var self = this;
    var photoToBeVerifiedUploadUrl = this.uploadUrls.data.faceToBeValidated.uploadUrl;

    fs.readFile(PHOTO_TO_BE_VERIFIED_FILE_LOCATION, async (err, data) => {
      if (err) throw err;

      var config = {
        method: 'put',
        url: photoToBeVerifiedUploadUrl,
        data: data
      };
      await axios(config)
        .then(function(response) {
          console.log("Successfully uploaded photo to be verified");
        })
        .catch(function(error) {
          console.log(error);
        });
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
