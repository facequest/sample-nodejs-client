/**
 * This is an example client for FaceQuest face verification services
 *
 */

const axios = require('axios');
const fs = require('fs');
const { uuid } = require('uuidv4');
const FormData = require('form-data');
const async = require('async');

const FACEQUEST_REGISTERED_EMAIL = "email@example.com"
const FACEQUEST_SECRET = "my_super_secret"
const FACEQUEST_VERIFICATION_BASE_URL="https://verifyapi.facequest.io"
const FACEQUEST_BASE_URL="https://app.facequest.io"

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
    this.referencePhotoIdInFolder = undefined;
  }

  storeReferencePhotoId = (referencePhotoId) => {
    this.referencePhotoIdInFolder = referencePhotoId;
  }

  async main() {
      console.log("Initiating verification with cloud storage flow... ");

      await this.initiateVerficiationWithoutStorage();

      // To test the verfication request with cloud storage, uncomment below line and try
      //await this.initiateVerficiationWithStorage();
  }

  async initiateVerficiationWithoutStorage(){
    var uploadUrls = await this.getUrlsToUploadPhotos();

    await this.uploadReferencePhoto(uploadUrls);

    await this.uploadPhotoToBeVerified(uploadUrls);

    var verificationRequestId = await this.fireVerificationRequestWithoutCloudStorage(uploadUrls);

    //poll for results
    this.pollingTimer = setInterval(this.checkIfVerificationCompleted.bind(this, verificationRequestId), 5000);
  }


  async initiateVerficiationWithStorage(){

    var folderId = await this.createFolder();

    await this.uploadReferencePhotoToFolder(this.storeReferencePhotoId, folderId);

    var uploadUrls = await this.getUrlsToUploadPhotos();

    await this.uploadPhotoToBeVerified(uploadUrls);

    setTimeout(async () =>{
      var verificationRequestId = await this.fireVerificationRequestWithCloudStorage(this.referencePhotoIdInFolder, uploadUrls);

      //poll for results
      this.pollingTimer = setInterval(this.checkIfVerificationCompleted.bind(this, verificationRequestId), 5000);
    }, 5000)
  }

  async getUrlsToUploadPhotos() {
    var self = this;
    return axios.get(
        FACEQUEST_VERIFICATION_BASE_URL+"/api/v1/verification/uploadurl",
        HEADER_DEFINITION
      )
      .then((response) => {
        console.log("Received upload url data: \n" + self.prettyPrint(response.data))
        return response.data;
      })
      .catch((err) => {
        console.error("Error fetching upload URLs:\n " + self.prettyPrint(err));
      });
  }


  async uploadReferencePhoto(uploadUrls) {
    var self = this;
    var referencePhotoUploadUrl = uploadUrls.data.referencePhoto.uploadUrl;

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
          console.log("Error uploading reference photo:\n"+self.prettyPrint(error));
        });
    });
  }

  async uploadPhotoToBeVerified(uploadUrls) {
    var self = this;
    var photoToBeVerifiedUploadUrl = uploadUrls.data.photoToBeVerified.uploadUrl;

  fs.readFile(PHOTO_TO_BE_VERIFIED_FILE_LOCATION, async (err, data) => {
      if (err) throw err;

      var config = {
        method: 'put',
        url: photoToBeVerifiedUploadUrl,
        data: data
      };
      return axios(config)
        .then(function(response) {
          console.log("Successfully uploaded photo to be verified");
        })
        .catch(function(error) {
          console.log("Error uploading photo to be verified:\n"+self.prettyPrint(error));
        });
    });
  }


  async fireVerificationRequestWithoutCloudStorage(uploadUrls) {
    const body = {
      title: TITLE_OF_VERIFICATION_JOB,
      notes: NOTES_FOR_VERIFICATION,
      referencePhotoFilePath: uploadUrls.data.referencePhoto.filePath,
      photoToBeVerifiedFilePath: uploadUrls.data.photoToBeVerified.filePath,
      useStoredPhotoForReference: "false"
    }

    const self = this;
    return axios.post(
        FACEQUEST_VERIFICATION_BASE_URL+"/api/v1/verification",
        body,
        HEADER_DEFINITION
      )
      .then((response) => {
        console.log("Verification triggered. Response: \n" + self.prettyPrint(response.data));
        var verificationRequestId = response.data.verificationRequestId;
        console.log("Request id - " + verificationRequestId);
        return verificationRequestId;
      })
      .catch((err) => {
        console.log("Error firing verification request:\n" + self.prettyPrint(err));
      });
  }

  
  async createFolder(){
    var folderName = uuid();
    var self = this;

    console.log("Gonna create folder to store reference photo");
    return axios.post(FACEQUEST_BASE_URL+'/api/v1/folders/' + folderName, {}, HEADER_DEFINITION).then(function(response) {
      console.debug("Successfully created folder. Response \n"+ self.prettyPrint(response.data));
      var folderId = response.data._embedded[0].id;
      console.log("Folder id - "+folderId);
      return folderId;
    }).catch(function(error) {
      console.log("Error creating folder:\n"+self.prettyPrint(error));
    });
  }

  async uploadReferencePhotoToFolder(callback, folderId){
    var referencePhotoName = "John Doe"
    var self = this;
    const formData = new FormData();

    fs.readFile(REFERENCE_PHOTO_FILE_LOCATION, async (err, data) => {
      if(err){
        console.log(err);
        return;
      }

      formData.append('file', data, {contentType: 'image/jpeg', filename: REFERENCE_PHOTO_FILE_LOCATION});
    
      var headers = Object.assign({},HEADER_DEFINITION.headers,formData.getHeaders());

      console.log("Gonna store reference photo into folder");
      return axios.post(FACEQUEST_BASE_URL+'/api/v1/reference-faces/' + referencePhotoName + "/folder/" + folderId, formData, {'headers':headers}).then(function(response) {
        console.debug("Successfully uploaded reference photo to folder. Response \n"+ self.prettyPrint(response.data))
        var referencePhotoIdInFolder = response.data.id.toString();
        console.log("Reference photo id: "+referencePhotoIdInFolder);
        callback(referencePhotoIdInFolder);
      }).catch(function(error) {
        console.log("Error uploading reference photo to folder:\n"+self.prettyPrint(error));  
        });
     });
  }

  
  async fireVerificationRequestWithCloudStorage(referencePhotoId, uploadUrls) {
    const body = {
      title: TITLE_OF_VERIFICATION_JOB,
      notes: NOTES_FOR_VERIFICATION,
      referencePhotoFilePath: referencePhotoId,
      photoToBeVerifiedFilePath: uploadUrls.data.photoToBeVerified.filePath,
      useStoredPhotoForReference: "true"
    }
    
    const self = this;
    return axios.post(
        FACEQUEST_VERIFICATION_BASE_URL+"/api/v1/verification",
        body,
        HEADER_DEFINITION
      )
      .then((response) => {
        console.log("Verification triggered. Response: \n" + self.prettyPrint(response.data));
        var verificationRequestId = response.data.verificationRequestId;
        console.log("Request id - " + verificationRequestId);
        return verificationRequestId;
      })
      .catch((err) => {
        console.log("Error firing verification request:\n" + self.prettyPrint(err));
      });
  }

  async checkIfVerificationCompleted(verificationRequestId) {
    const self = this;
    axios
      .get(
        FACEQUEST_VERIFICATION_BASE_URL+"/api/v1/verification/" + verificationRequestId,
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
        console.error("Error while polling for result: \n" + err);
        self.stopPolling();
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
